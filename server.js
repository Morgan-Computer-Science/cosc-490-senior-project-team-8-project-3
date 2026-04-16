// Node.js Backend Server - integrates React frontend with Python transcript validation
// Entry point: node server.js

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawn } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';
import pg from 'pg';
import {
  ALLOWED_DEPARTMENT_PREFIXES,
  classifyCourse,
  isTranscriptTermMarker,
  normalizeCourseCode as normalizeSeedCourseCode,
  parseDegreeWorksCourseRows,
  parseRequirementOptionText,
  parseDegreeWorksSatisfiedBlocks,
} from './shared/morgan-state-cs-bs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const HOST = process.env.HOST || '127.0.0.1';
const PORT = process.env.PORT || 3001;
const DEFAULT_VERTEX_MODEL = process.env.VERTEX_MODEL || 'gemini-2.5-flash';

let courseReferenceCache = null;

function loadLocalEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

// Anthropic client (used for chat, OCR, audit agent, schedule agent)
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

if (!anthropic) console.warn('ANTHROPIC_API_KEY not set — chat, OCR, and agent features disabled');

// DB pool (optional — gracefully falls back when Docker DB is not running)
const { Pool } = pg;
let db = null;
try {
  db = new Pool({ connectionString: process.env.DATABASE_URL });
  db.on('error', (err) => console.error('DB pool error:', err.message));
} catch (e) {
  console.warn('DB unavailable:', e.message);
}

// In-memory chat sessions: sessionId → { messages, context }
const chatSessions = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const name = file.fieldname + '-' + timestamp + path.extname(file.originalname);
    cb(null, name);
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const isTranscript = file.fieldname === 'transcript';
    const isBearCard = file.fieldname === 'bearCard';
    const allowedBearCardTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

    if (isTranscript && file.mimetype === 'application/pdf') {
      cb(null, true);
    } else if (isBearCard && allowedBearCardTypes.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(isBearCard ? 'Only JPG, PNG, WebP, or HEIC images are allowed for Bear Card uploads' : 'Only PDF files are allowed for transcripts'));
    }
  }
});

/**
 * Run Python validation script and return results
 */
function runPythonValidation(pdfPath) {
  return new Promise((resolve, reject) => {
    // Call Python script: python3 test_transcript.py <pdf_path>
    const pythonProcess = spawn('python3', ['test_transcript.py', pdfPath]);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script failed: ${stderr}`));
      } else {
        // Parse the output and extract validation data
        const validationResult = parseValidationOutput(stdout);
        resolve(validationResult);
      }
    });

    pythonProcess.on('error', (err) => {
      reject(err);
    });
  });
}

function extractPdfText(pdfPath) {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', ['-c', `
import sys
import fitz

pdf_path = sys.argv[1]
doc = fitz.open(pdf_path)
text = ""
for page in doc:
    text += page.get_text()
doc.close()
print(text)
`, pdfPath]);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || 'Failed to extract PDF text'));
      } else {
        resolve(stdout);
      }
    });

    pythonProcess.on('error', (err) => {
      reject(err);
    });
  });
}

function safeParseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeCourseCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function extractCourseCodesFromText(text) {
  const matches = String(text || '').match(/\b[A-Z]{2,5}\s*-?\s*\d{3,4}\b/gi) || [];
  return [...new Set(matches
    .map((match) => normalizeSeedCourseCode(match))
    .filter((courseCode) => ALLOWED_DEPARTMENT_PREFIXES.has(courseCode.replace(/\d+$/, ''))))];
}

async function getCourseReferenceData() {
  if (courseReferenceCache) return courseReferenceCache;

  const courseReference = await new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', ['-c', `
import sys
sys.path.insert(0, '.')
from course_reference import COURSE_REFERENCE
import json
print(json.dumps(COURSE_REFERENCE))
`]);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || 'Failed to fetch course reference'));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error('Failed to parse course reference'));
      }
    });
  });

  courseReferenceCache = courseReference;
  return courseReference;
}

function getCourseTitle(reference, code) {
  const normalizedCode = normalizeCourseCode(code);
  if (!normalizedCode) return 'Unknown Course';

  const buckets = [
    reference?.core_cs_courses || {},
    reference?.cs_electives || {},
    reference?.math_requirements || {},
    reference?.cloud_courses || {},
  ];

  for (const bucket of buckets) {
    if (bucket[normalizedCode]) return bucket[normalizedCode];
  }

  for (const category of Object.values(reference?.gen_ed_courses || {})) {
    if (category?.[normalizedCode]) return category[normalizedCode];
  }

  return 'Unknown Course';
}

function buildFallbackSuggestions(reference, requestedCourses, validation) {
  const requested = (requestedCourses || []).map(normalizeCourseCode).filter(Boolean);
  const missingCore = (validation?.missingCoreRequirements || []).map(normalizeCourseCode);
  const missingMath = (validation?.missingMathRequirements || []).map(normalizeCourseCode);
  const electivePool = Object.keys(reference?.cs_electives || {}).map(normalizeCourseCode);
  const cloudPool = Object.keys(reference?.cloud_courses || {}).map(normalizeCourseCode);
  const completed = new Set([
    ...(validation?.completedCoreRequirements || []),
    ...(validation?.completedMathRequirements || []),
    ...(validation?.unknownCourses || []),
  ].map(normalizeCourseCode));

  const suggestions = [];
  const seen = new Set();

  const pushSuggestion = (code, reason) => {
    const normalized = normalizeCourseCode(code);
    if (!normalized || seen.has(normalized) || completed.has(normalized)) return;

    seen.add(normalized);
    suggestions.push({
      code: normalized,
      name: getCourseTitle(reference, normalized),
      reason,
    });
  };

  for (const code of requested) {
    pushSuggestion(code, 'You explicitly requested this course.');
  }

  for (const code of missingCore) {
    pushSuggestion(code, 'This is still a missing core requirement.');
  }

  for (const code of missingMath) {
    pushSuggestion(code, 'This is still a missing math requirement.');
  }

  for (const code of cloudPool) {
    pushSuggestion(code, 'This supports the cloud/computing track after required courses.');
  }

  for (const code of electivePool) {
    pushSuggestion(code, 'This is a CS elective option once required work is covered.');
  }

  return suggestions.slice(0, 6);
}

function buildFallbackSchedule({ validation }) {
  const candidates = validation?.recommendationCandidates || [];
  return candidates.slice(0, 5).map((item, index) => ({
    code: item.code,
    name: item.name,
    reason: item.reason,
    priority: index + 1,
    recommendationType: item.recommendationType || 'Required',
  }));
}

function extractJsonArray(text) {
  if (!text) return null;
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function extractJsonObject(text) {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function buildFallbackSummary({ studentInfo, goals, requestedCourses, validation }) {
  const missingCore = validation?.missingCoreRequirements || [];
  const missingMath = validation?.missingMathRequirements || [];
  const unknownCourses = validation?.unknownCourses || [];
  const completedCore = validation?.completedCoreRequirements || [];
  const completedMath = validation?.completedMathRequirements || [];

  const headline =
    validation?.status === 'COMPLETE'
      ? 'You are in strong shape for the CS degree.'
      : validation?.status === 'INVALID_COURSES_FOUND'
        ? 'Your transcript needs cleanup before the degree audit is fully reliable.'
        : 'You still have required coursework left before graduation.';

  const summary = [
    `${studentInfo?.name || 'This student'} has completed ${completedCore.length} core CS course(s) and ${completedMath.length} math requirement(s).`,
    missingCore.length || missingMath.length
      ? `${missingCore.length} core CS course(s) and ${missingMath.length} math course(s) are still missing.`
      : 'No core or math requirements are currently missing.',
    unknownCourses.length
      ? `${unknownCourses.length} course(s) were not recognized in the curriculum and should be reviewed manually.`
      : 'All recognized courses were mapped into the curriculum.',
  ].join(' ');

  const recommendations = [];
  if (missingCore.length) recommendations.push(`Prioritize required CS courses next, starting with ${missingCore.slice(0, 3).join(', ')}.`);
  if (missingMath.length) recommendations.push(`Plan the remaining math requirements soon: ${missingMath.slice(0, 3).join(', ')}.`);
  if (requestedCourses?.length) recommendations.push(`Requested course preferences were noted: ${requestedCourses.slice(0, 4).join(', ')}.`);
  if (goals) recommendations.push(`Keep the stated goal in view: ${goals}`);

  const risks = [];
  if (unknownCourses.length) risks.push(`Unknown transcript entries need manual review: ${unknownCourses.slice(0, 5).join(', ')}.`);
  if (missingCore.length > 3) risks.push('A large number of remaining core requirements could delay graduation if sequencing is not planned carefully.');
  if (!recommendations.length) recommendations.push('Submit another planning pass after transcript cleanup or when you have target courses for the next term.');

  return {
    headline,
    summary,
    recommendations,
    risks,
    source: 'fallback',
  };
}

async function callVertexModel({ systemInstruction, prompt, temperature = 0.2 }) {
  const apiKey = process.env.VERTEX_API_KEY;
  if (!apiKey) {
    throw new Error('Missing VERTEX_API_KEY');
  }

  const response = await fetch(`https://aiplatform.googleapis.com/v1/publishers/google/models/${DEFAULT_VERTEX_MODEL}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vertex request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('').trim() || '';
  if (!text) {
    throw new Error('Vertex returned an empty response');
  }

  return text;
}

async function fetchVertexTranscriptSummary({ studentInfo, requestedCourses, goals, validation, reference }) {

  const completedCourses = [
    ...(validation?.completedCoreRequirements || []),
    ...(validation?.completedMathRequirements || []),
  ].map((code) => ({
    code: normalizeCourseCode(code),
    title: getCourseTitle(reference, code),
  }));

  const missingCourses = [
    ...(validation?.missingCoreRequirements || []),
    ...(validation?.missingMathRequirements || []),
  ].map((code) => ({
    code: normalizeCourseCode(code),
    title: getCourseTitle(reference, code),
  }));

  const unknownCourses = (validation?.unknownCourses || []).map((code) => normalizeCourseCode(code));

  const prompt = [
    'Summarize this Morgan State computer science transcript review for a student-facing results page.',
    'Return JSON only.',
    'Use exactly this shape:',
    '{"headline":"string","summary":"string","recommendations":["string"],"risks":["string"]}',
    'Keep the headline under 16 words.',
    'Keep the summary to 2-4 sentences.',
    'Recommendations should be concrete next steps.',
    'Risks should call out transcript issues or graduation blockers.',
    '',
    `Student: ${JSON.stringify(studentInfo || {})}`,
    `Goals: ${goals || 'None provided'}`,
    `Requested courses: ${JSON.stringify((requestedCourses || []).map(normalizeCourseCode).filter(Boolean))}`,
    `Validation status: ${validation?.status || 'UNKNOWN'}`,
    `Completed courses: ${JSON.stringify(completedCourses)}`,
    `Missing required courses: ${JSON.stringify(missingCourses)}`,
    `Unknown courses: ${JSON.stringify(unknownCourses)}`,
  ].join('\n');

  const text = await callVertexModel({
    systemInstruction: 'You are a precise academic advising assistant. Output JSON only.',
    prompt,
    temperature: 0.2,
  });
  const parsed = extractJsonObject(text);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Vertex returned non-JSON summary');
  }

  return {
    headline: String(parsed.headline || '').trim(),
    summary: String(parsed.summary || '').trim(),
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map((item) => String(item).trim()).filter(Boolean).slice(0, 4) : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks.map((item) => String(item).trim()).filter(Boolean).slice(0, 4) : [],
    source: 'vertex',
  };
}

async function fetchVertexSuggestions({ requestedCourses, goals, studentInfo, validation, reference }) {
  const completedCourses = [
    ...(validation?.completedCoreRequirements || []),
    ...(validation?.completedMathRequirements || []),
  ].map((code) => ({
    code: normalizeCourseCode(code),
    title: getCourseTitle(reference, code),
  }));

  const missingCourses = [
    ...(validation?.missingCoreRequirements || []),
    ...(validation?.missingMathRequirements || []),
  ].map((code) => ({
    code: normalizeCourseCode(code),
    title: getCourseTitle(reference, code),
  }));

  const electiveOptions = [
    ...Object.entries(reference?.cs_electives || {}),
    ...Object.entries(reference?.cloud_courses || {}),
  ].map(([code, title]) => ({ code, title }));

  const prompt = [
    'You are advising a Morgan State computer science student on which classes to take next.',
    'Return only valid JSON as an array of up to 6 objects.',
    'Each object must have exactly these string fields: code, name, reason.',
    'Prioritize missing required core and math courses before electives unless the requested courses make a strong case.',
    'Never recommend a course already completed.',
    'Use the provided course titles.',
    '',
    `Student year: ${studentInfo?.year || 'Unknown'}`,
    `Goals: ${goals || 'None provided'}`,
    `Requested courses: ${JSON.stringify((requestedCourses || []).map(normalizeCourseCode).filter(Boolean))}`,
    `Completed courses: ${JSON.stringify(completedCourses)}`,
    `Missing required courses: ${JSON.stringify(missingCourses)}`,
    `Elective options: ${JSON.stringify(electiveOptions)}`,
  ].join('\n');

  const text = await callVertexModel({
    systemInstruction: 'You are a precise academic advising assistant. Output JSON only.',
    prompt,
    temperature: 0.2,
  });
  const parsed = extractJsonArray(text);

  if (!Array.isArray(parsed)) {
    throw new Error('Vertex returned non-JSON suggestions');
  }

  return parsed
    .map((item) => ({
      code: normalizeCourseCode(item?.code),
      name: String(item?.name || '').trim() || getCourseTitle(reference, item?.code),
      reason: String(item?.reason || '').trim(),
    }))
    .filter((item) => item.code && item.reason)
    .slice(0, 6);
}

async function fetchVertexSchedulePlan({ requestedCourses, goals, studentInfo, validation, reference }) {
  const protectedCourses = [...(validation?.completedOrProtectedCourses || [])].map((code) => ({
    code: normalizeCourseCode(code),
    title: getCourseTitle(reference, code),
  }));

  const missingCourses = (validation?.recommendationCandidates || []).map((item) => ({
    code: normalizeCourseCode(item.code),
    title: item.name || getCourseTitle(reference, item.code),
    reason: item.reason,
    recommendationType: item.recommendationType || 'Required',
  }));

  const eligibleOptions = (validation?.availableOptions || []).map((item) => ({
    code: normalizeCourseCode(item.normalizedCourseCode),
    title: item.matchedRequirement || getCourseTitle(reference, item.normalizedCourseCode),
  }));

  const prompt = [
    'Create a recommended next-course schedule for a Morgan State computer science student.',
    'Only recommend courses that satisfy genuinely unmet requirements.',
    'Never recommend a course that is completed, satisfied, or in progress.',
    'Use eligible requirement-option courses only when the requirement is unmet.',
    'Return JSON only as an array of up to 5 objects.',
    'Each object must have exactly these fields: code, name, reason, priority.',
    'priority must be a number from 1 upward in recommended order.',
    '',
    `Student: ${JSON.stringify(studentInfo || {})}`,
    `Goals: ${goals || 'None provided'}`,
    `Requested courses: ${JSON.stringify((requestedCourses || []).map(normalizeCourseCode).filter(Boolean))}`,
    `Protected courses (completed, satisfied, or in progress): ${JSON.stringify(protectedCourses)}`,
    `Recommendation candidates: ${JSON.stringify(missingCourses)}`,
    `Eligible option candidates: ${JSON.stringify(eligibleOptions)}`,
  ].join('\n');

  const text = await callVertexModel({
    systemInstruction: 'You are a precise academic advising assistant. Output JSON only.',
    prompt,
    temperature: 0.2,
  });
  const parsed = extractJsonArray(text);

  if (!Array.isArray(parsed)) {
    throw new Error('Vertex returned non-JSON schedule');
  }

  return parsed
    .map((item, index) => ({
      code: normalizeCourseCode(item?.code),
      name: String(item?.name || '').trim() || getCourseTitle(reference, item?.code),
      reason: String(item?.reason || '').trim(),
      priority: Number.isFinite(Number(item?.priority)) ? Number(item.priority) : index + 1,
      recommendationType: String(item?.recommendationType || '').trim() || 'Required',
    }))
    .filter((item) => item.code && item.reason)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 5);
}

function buildRecommendationState({ classifiedCourses, requirementOptionMatches, reference }) {
  const protectedStatuses = new Set(['COMPLETED', 'SATISFIED', 'IN_PROGRESS']);
  const completedOrProtectedCourses = new Set(
    classifiedCourses
      .filter((course) => protectedStatuses.has(course.status))
      .map((course) => course.normalizedCourseCode)
  );

  const availableOptions = [...requirementOptionMatches.values()]
    .filter((option) => !completedOrProtectedCourses.has(option.normalizedCourseCode))
    .map((option) => ({
      ...option,
      recommendationType: 'Eligible Option',
    }));

  const requiredTargets = [];

  for (const code of classifiedCourses
    .filter((course) => course.sourceOfMatch === 'CURRICULUM_SEED' && course.status === 'IN_PROGRESS')
    .map((course) => course.normalizedCourseCode)) {
    completedOrProtectedCourses.add(code);
  }

  const requiredBuckets = [
    ...(Object.keys(reference?.core_cs_courses || {}).map((code) => ({
      code,
      name: getCourseTitle(reference, code),
      reason: 'Core CS requirement not yet completed or satisfied.',
      recommendationType: 'Required',
    }))),
    ...(Object.keys(reference?.math_requirements || {}).map((code) => ({
      code,
      name: getCourseTitle(reference, code),
      reason: 'Math requirement not yet completed or satisfied.',
      recommendationType: 'Required',
    }))),
  ];

  for (const candidate of requiredBuckets) {
    const normalizedCode = normalizeCourseCode(candidate.code);
    if (completedOrProtectedCourses.has(normalizedCode)) continue;
    if (requiredTargets.some((item) => item.code === normalizedCode)) continue;
    requiredTargets.push({ ...candidate, code: normalizedCode });
  }

  const recommendationCandidates = [...requiredTargets, ...availableOptions]
    .filter((candidate) => !completedOrProtectedCourses.has(candidate.code));

  return {
    completedOrProtectedCourses: [...completedOrProtectedCourses],
    availableOptions,
    recommendationCandidates,
  };
}

/**
 * Parse Python script output and extract structured data
 */
function parseValidationOutput(output) {
  // Extract validation data from the formatted output
  const result = {
    totalFound: 0,
    validCount: 0,
    invalidCount: 0,
    validationRate: 0,
    foundCourses: [],
    coursesByCategory: {
      core: [],
      electives: [],
      math: [],
      cloud: [],
      genEd: [],
      unknown: []
    },
    completedCoreRequirements: [],
    missingCoreRequirements: [],
    completedMathRequirements: [],
    missingMathRequirements: [],
    unknownCourses: [],
    status: 'INCOMPLETE'
  };

  // Parse course counts
  const foundMatch = output.match(/COURSES FOUND IN TRANSCRIPT:\s*(\d+)/);
  if (foundMatch) result.totalFound = parseInt(foundMatch[1]);

  const validMatch = output.match(/Valid \(in curriculum\):\s*(\d+)/);
  if (validMatch) result.validCount = parseInt(validMatch[1]);

  const invalidMatch = output.match(/Unknown\/Invalid:\s*(\d+)/);
  if (invalidMatch) result.invalidCount = parseInt(invalidMatch[1]);

  const rateMatch = output.match(/Validation Rate:\s*([\d.]+)%/);
  if (rateMatch) result.validationRate = parseFloat(rateMatch[1]);

  // Parse all discovered course codes from validation lines
  const foundCourseMatches = output.match(/^\s+[A-Z]{2,}\d+\s+→/gm);
  if (foundCourseMatches) {
    result.foundCourses = foundCourseMatches.map((line) => line.trim().split(/\s+→/)[0]);
  }

  // Parse breakdown by category
  const coreMatch = output.match(/Core CS Courses:\s*(\d+)/);
  if (coreMatch) result.coursesByCategory.core = Array(parseInt(coreMatch[1]));

  const electivesMatch = output.match(/CS Electives:\s*(\d+)/);
  if (electivesMatch) result.coursesByCategory.electives = Array(parseInt(electivesMatch[1]));

  const mathMatch = output.match(/Math Requirements:\s*(\d+)/);
  if (mathMatch) result.coursesByCategory.math = Array(parseInt(mathMatch[1]));

  const cloudMatch = output.match(/Cloud Courses:\s*(\d+)/);
  if (cloudMatch) result.coursesByCategory.cloud = Array(parseInt(cloudMatch[1]));

  const genEdMatch = output.match(/General Education:\s*(\d+)/);
  if (genEdMatch) result.coursesByCategory.genEd = Array(parseInt(genEdMatch[1]));

  // Parse completed core courses
  const completedCoreSection = output.match(/✓ Completed Courses:([\s\S]*?)(?:Missing Core|✗|$)/);
  if (completedCoreSection) {
    const courses = completedCoreSection[1].match(/• (COSC\d+):/g);
    if (courses) {
      result.completedCoreRequirements = courses.map(c => c.replace(/[•:]| /g, ''));
    }
  }

  // Parse missing core courses
  const missingCoreSection = output.match(/Missing Core Requirements \((\d+)\):([\s\S]*?)(?:MATH REQUIREMENTS|📐|$)/);
  if (missingCoreSection) {
    const courses = missingCoreSection[2].match(/• (COSC\d+):/g);
    if (courses) {
      result.missingCoreRequirements = courses.map(c => c.replace(/[•:]| /g, ''));
    }
  }

  // Parse missing math courses
  const completedMathSection = output.match(/MATH REQUIREMENTS:[\s\S]*?Completed:\s*\d+\/\d+([\s\S]*?)(?:Missing Math Courses|✗|UNKNOWN|INVALID|⚠️|$)/);
  if (completedMathSection) {
    const courses = completedMathSection[1].match(/• (MATH\d+):/g);
    if (courses) {
      result.completedMathRequirements = courses.map(c => c.replace(/[•:]| /g, ''));
    }
  }

  const missingMathSection = output.match(/Missing Math Courses \((\d+)\):([\s\S]*?)(?:UNKNOWN|INVALID|⚠️|$)/);
  if (missingMathSection) {
    const courses = missingMathSection[2].match(/• (MATH\d+):/g);
    if (courses) {
      result.missingMathRequirements = courses.map(c => c.replace(/[•:]| /g, ''));
    }
  }

  // Parse unknown courses
  const unknownSection = output.match(/UNKNOWN\/INVALID COURSES \((\d+)\):([\s\S]*?)(?:\n\n|$)/);
  if (unknownSection) {
    const courses = unknownSection[2].match(/• (\w+\d*)/g);
    if (courses) {
      result.unknownCourses = courses.map(c => c.replace('• ', ''));
    }
  }

  // Determine status
  if (result.invalidCount === 0 && result.missingCoreRequirements.length === 0 && result.missingMathRequirements.length === 0) {
    result.status = 'COMPLETE';
  } else if (result.invalidCount === 0) {
    result.status = 'INCOMPLETE';
  } else {
    result.status = 'INVALID_COURSES_FOUND';
  }

  const termMarkers = result.foundCourses.filter((courseCode) => isTranscriptTermMarker(courseCode));
  if (termMarkers.length > 0) {
    result.termMarkers = termMarkers;
    result.foundCourses = result.foundCourses.filter((courseCode) => !isTranscriptTermMarker(courseCode));
    result.unknownCourses = result.unknownCourses.filter((courseCode) => !isTranscriptTermMarker(courseCode));
    result.totalFound = Math.max(0, result.totalFound - termMarkers.length);
    result.invalidCount = result.unknownCourses.length;
    result.validCount = Math.max(0, result.totalFound - result.invalidCount);
    result.validationRate = result.totalFound > 0
      ? (result.validCount / result.totalFound) * 100
      : 0;

    if (result.invalidCount === 0 && result.missingCoreRequirements.length === 0 && result.missingMathRequirements.length === 0) {
      result.status = 'COMPLETE';
    } else if (result.invalidCount === 0) {
      result.status = 'INCOMPLETE';
    } else {
      result.status = 'INVALID_COURSES_FOUND';
    }
  } else {
    result.termMarkers = [];
  }

  return result;
}

function groupClassifiedCourses(classifiedCourses) {
  const grouped = {
    CS_CORE: [],
    SUPPORTING_REQUIRED: [],
    MATH_REQUIRED: [],
    GEN_ED_REQUIRED: [],
    GEN_ED_ELECTIVE: [],
    FREE_ELECTIVE: [],
    UNKNOWN: [],
  };

  for (const course of classifiedCourses) {
    if (grouped[course.category]) {
      grouped[course.category].push(course.normalizedCourseCode);
    } else if (course.category !== 'TRANSCRIPT_TERM') {
      grouped.UNKNOWN.push(course.normalizedCourseCode);
    }
  }

  return grouped;
}

// ─────────────────────────────────────────────────────────────────────
// Agentic helpers
// ─────────────────────────────────────────────────────────────────────

function buildChatSystemPrompt(context) {
  const { student, validation, recommendedSchedule } = context || {};
  const completed = [
    ...(validation?.completedCoreRequirements || []),
    ...(validation?.completedMathRequirements || []),
  ];
  const missing = [
    ...(validation?.missingCoreRequirements || []),
    ...(validation?.missingMathRequirements || []),
  ];

  return [
    'You are BearAdvisor, an AI academic advisor for Morgan State University Computer Science B.S. students.',
    'You are speaking with a student about their specific degree progress. Be concise, specific, and encouraging.',
    'Use the transcript data below to answer questions precisely. Do not guess if data is missing.',
    '',
    student?.name ? `Student: ${student.name}${student.year ? `, ${student.year}` : ''}` : '',
    completed.length
      ? `Completed core/math courses: ${completed.join(', ')}`
      : 'No core or math courses completed yet.',
    missing.length
      ? `Still missing required courses: ${missing.join(', ')}`
      : 'All core and math requirements are satisfied.',
    validation?.unknownCourses?.length
      ? `Unclassified transcript entries needing review: ${validation.unknownCourses.join(', ')}`
      : '',
    recommendedSchedule?.length
      ? `Currently recommended next courses: ${recommendedSchedule.map((c) => `${c.code} (${c.name || c.code})`).join(', ')}`
      : '',
    '',
    'CS B.S. requirements: 12 core COSC courses, 4 math courses (MATH241/242/312/331), gen ed, and CS electives.',
    'Keep responses under 200 words unless the question genuinely requires more detail.',
  ]
    .filter(Boolean)
    .join('\n');
}

async function runAuditAgent({ student, validation }) {
  if (!anthropic) throw new Error('Anthropic API not configured');

  const tools = [
    {
      name: 'record_requirement',
      description: 'Record the audit status of one degree requirement category',
      input_schema: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'e.g. "Core CS", "Mathematics", "General Education"' },
          status: { type: 'string', enum: ['SATISFIED', 'PARTIAL', 'MISSING'] },
          completed: { type: 'array', items: { type: 'string' } },
          missing: { type: 'array', items: { type: 'string' } },
          notes: { type: 'string' },
        },
        required: ['category', 'status', 'completed', 'missing', 'notes'],
      },
    },
    {
      name: 'add_risk',
      description: 'Flag a graduation risk',
      input_schema: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
          description: { type: 'string' },
          action: { type: 'string' },
        },
        required: ['severity', 'description', 'action'],
      },
    },
    {
      name: 'finalize_audit',
      description: 'Complete the audit with overall assessment',
      input_schema: {
        type: 'object',
        properties: {
          overall_status: {
            type: 'string',
            enum: ['ON_TRACK', 'AT_RISK', 'NEEDS_IMMEDIATE_ATTENTION'],
          },
          estimated_semesters: { type: 'number' },
          summary: { type: 'string' },
        },
        required: ['overall_status', 'estimated_semesters', 'summary'],
      },
    },
  ];

  const auditResult = { requirements: [], risks: [], overall: null };

  const messages = [
    {
      role: 'user',
      content: `Audit this Morgan State CS B.S. student's degree progress.

Student: ${JSON.stringify(student || {})}
Completed core CS (${(validation?.completedCoreRequirements || []).length}/12): ${JSON.stringify(validation?.completedCoreRequirements || [])}
Missing core CS: ${JSON.stringify(validation?.missingCoreRequirements || [])}
Completed math (${(validation?.completedMathRequirements || []).length}/4): ${JSON.stringify(validation?.completedMathRequirements || [])}
Missing math: ${JSON.stringify(validation?.missingMathRequirements || [])}
Supporting completed: ${JSON.stringify(validation?.completedSupportingRequirements || [])}
Gen Ed completed: ${JSON.stringify(validation?.completedGenEdRequirements || [])}
Gen Ed electives: ${JSON.stringify(validation?.completedGenEdElectives || [])}
Unclassified: ${JSON.stringify(validation?.unknownCourses || [])}

Call record_requirement for each category (Core CS, Mathematics, General Education, Electives, Supporting).
Call add_risk for any graduation risks you identify.
Finish with finalize_audit.`,
    },
  ];

  for (let i = 0; i < 10; i++) {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: 'You are a precise degree audit agent. Systematically audit each requirement category using the tools.',
      tools,
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    const toolUses = response.content.filter((b) => b.type === 'tool_use');
    if (toolUses.length === 0 || response.stop_reason === 'end_turn') break;

    const results = [];
    let done = false;

    for (const tu of toolUses) {
      if (tu.name === 'record_requirement') {
        auditResult.requirements.push(tu.input);
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: 'Recorded.' });
      } else if (tu.name === 'add_risk') {
        auditResult.risks.push(tu.input);
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: 'Recorded.' });
      } else if (tu.name === 'finalize_audit') {
        auditResult.overall = tu.input;
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: 'Audit finalized.' });
        done = true;
      }
    }

    messages.push({ role: 'user', content: results });
    if (done) break;
  }

  return auditResult;
}

async function runScheduleAgent({ student, validation, reference, goals, requestedCourses }) {
  if (!anthropic) throw new Error('Anthropic API not configured');

  const protectedCodes = new Set(
    (validation?.completedOrProtectedCourses || []).map(normalizeCourseCode)
  );
  const candidates = (validation?.recommendationCandidates || []).filter(
    (c) => !protectedCodes.has(normalizeCourseCode(c.code))
  );

  const tools = [
    {
      name: 'add_course_to_plan',
      description: 'Add a course to the multi-semester plan',
      input_schema: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          name: { type: 'string' },
          semester: { type: 'string', description: 'e.g. "Fall 2026"' },
          reason: { type: 'string' },
          priority: { type: 'number' },
          credit_hours: { type: 'number' },
        },
        required: ['code', 'name', 'semester', 'reason', 'priority'],
      },
    },
    {
      name: 'add_planning_note',
      description: 'Add a scheduling note or constraint',
      input_schema: {
        type: 'object',
        properties: {
          note: { type: 'string' },
          type: {
            type: 'string',
            enum: ['PREREQUISITE', 'SEQUENCING', 'WORKLOAD', 'GOAL_ALIGNMENT'],
          },
        },
        required: ['note', 'type'],
      },
    },
    {
      name: 'finalize_plan',
      description: 'Complete the plan with summary',
      input_schema: {
        type: 'object',
        properties: {
          semesters_to_graduation: { type: 'number' },
          summary: { type: 'string' },
          credit_load_warning: { type: 'string' },
        },
        required: ['semesters_to_graduation', 'summary'],
      },
    },
  ];

  const planResult = { courses: [], notes: [], summary: null };

  const messages = [
    {
      role: 'user',
      content: `Create an optimized multi-semester course plan for this Morgan State CS B.S. student.

Student: ${JSON.stringify({ ...(student || {}), goals: goals || 'Not specified' })}
Already completed/protected: ${JSON.stringify([...protectedCodes])}
Available to schedule: ${JSON.stringify(candidates)}
Requested by student: ${JSON.stringify((requestedCourses || []).map(normalizeCourseCode))}

Key constraints:
- MATH241 → MATH242 (Calc I before Calc II)
- COSC111 → COSC112 (intro sequence)
- COSC490 (Capstone I) and COSC459 (Capstone II) need senior standing
- Recommend at most 5 courses per semester for a reasonable workload

Use add_course_to_plan for each recommended course (up to 8 courses across next 2-3 semesters).
Use add_planning_note for key sequencing constraints.
Finish with finalize_plan.`,
    },
  ];

  for (let i = 0; i < 10; i++) {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: 'You are a course scheduling agent. Create an optimal multi-semester plan using the provided tools.',
      tools,
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    const toolUses = response.content.filter((b) => b.type === 'tool_use');
    if (toolUses.length === 0 || response.stop_reason === 'end_turn') break;

    const results = [];
    let done = false;

    for (const tu of toolUses) {
      if (tu.name === 'add_course_to_plan') {
        planResult.courses.push(tu.input);
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: 'Added.' });
      } else if (tu.name === 'add_planning_note') {
        planResult.notes.push(tu.input);
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: 'Noted.' });
      } else if (tu.name === 'finalize_plan') {
        planResult.summary = tu.input;
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: 'Plan finalized.' });
        done = true;
      }
    }

    messages.push({ role: 'user', content: results });
    if (done) break;
  }

  planResult.courses.sort((a, b) => (a.priority || 0) - (b.priority || 0));
  return planResult;
}

async function persistSession({ student, confirmationId, classifiedCourses, validationSummary }) {
  if (!db) return null;
  try {
    const studentRes = await db.query(
      `INSERT INTO students (student_id, name, major)
       VALUES ($1, $2, $3)
       ON CONFLICT (student_id) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [
        student?.netid || confirmationId,
        student?.name || 'Unknown',
        student?.major || 'Computer Science B.S.',
      ]
    );
    const studentDbId = studentRes.rows[0].id;

    const sessionRes = await db.query(
      `INSERT INTO sessions (student_id, summary) VALUES ($1, $2) RETURNING id`,
      [studentDbId, JSON.stringify(validationSummary)]
    );

    return sessionRes.rows[0].id;
  } catch (err) {
    console.error('DB persist error:', err.message);
    return null;
  }
}

/**
 * POST /api/upload-transcript
 * Upload and validate transcript
 */
app.post('/api/upload-transcript', upload.single('transcript'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`Processing transcript: ${req.file.path}`);

    // Run Python validation
    const validationResult = await runPythonValidation(req.file.path);

    // Clean up uploaded file after processing
    setTimeout(() => {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }, 1000);

    // Return validation result
    res.json({
      success: true,
      transcript_id: `transcript_${Date.now()}`,
      fileName: req.file.originalname,
      validation: validationResult,
      extractedCourses: validationResult.validCount,
      parsedCourses: [
        ...validationResult.completedCoreRequirements,
        ...validationResult.completedMathRequirements,
        ...validationResult.coursesByCategory.electives,
        ...validationResult.coursesByCategory.cloud,
        ...validationResult.coursesByCategory.genEd,
      ]
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: error.message || 'Transcript validation failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/submit
 * Submit the full advising form and run transcript processing once.
 */
app.post('/api/submit', upload.fields([
  { name: 'transcript', maxCount: 1 },
  { name: 'bearCard', maxCount: 1 },
]), async (req, res) => {
  const transcriptFile = req.files?.transcript?.[0];
  const bearCardFile = req.files?.bearCard?.[0];

  try {
    if (!transcriptFile) {
      return res.status(400).json({ error: 'A transcript PDF is required' });
    }

    const student = safeParseJson(req.body.student, {});
    const requestedCourses = safeParseJson(req.body.courses, []);
    const goals = req.body.goals || '';
    const notes = req.body.notes || '';

    console.log(`Processing advising submission for transcript: ${transcriptFile.path}`);

    const transcriptText = await extractPdfText(transcriptFile.path);
    const validationResult = await runPythonValidation(transcriptFile.path);
    const reference = await getCourseReferenceData();
    const parsedDegreeWorksRows = parseDegreeWorksCourseRows(transcriptText);
    const degreeWorksMatches = parseDegreeWorksSatisfiedBlocks(transcriptText);
    const requirementOptionMatches = parseRequirementOptionText(transcriptText);
    const extractedCourseCodes = extractCourseCodesFromText(transcriptText)
      .filter((courseCode) => !isTranscriptTermMarker(courseCode));
    const parsedCourseCodes = parsedDegreeWorksRows.map((row) => row.courseCode);
    const optionCourseCodes = [...requirementOptionMatches.keys()];
    const courseUniverse = [...new Set([...parsedCourseCodes, ...extractedCourseCodes, ...optionCourseCodes])];

    const classifiedCourses = courseUniverse.map((courseCode) => {
      const parsedRow = parsedDegreeWorksRows.find((row) => row.courseCode === courseCode);
      return classifyCourse(courseCode, parsedRow?.courseTitle || null, {
        degreeWorksMatches,
        requirementOptionMatches,
      });
    });

    const recommendationState = buildRecommendationState({
      classifiedCourses,
      requirementOptionMatches,
      reference,
    });

    const groupedClassifications = groupClassifiedCourses(classifiedCourses);
    const unclassifiedCourses = classifiedCourses
      .filter((course) => course.status === 'UNCLASSIFIED' || course.category === 'UNKNOWN')
      .map((course) => course.normalizedCourseCode);

    validationResult.totalFound = classifiedCourses.length;
    validationResult.validCount = classifiedCourses.length - unclassifiedCourses.length;
    validationResult.invalidCount = unclassifiedCourses.length;
    validationResult.validationRate = validationResult.totalFound > 0
      ? (validationResult.validCount / validationResult.totalFound) * 100
      : 0;
    validationResult.unknownCourses = unclassifiedCourses;
    validationResult.coursesByCategory = {
      core: groupedClassifications.CS_CORE,
      electives: groupedClassifications.FREE_ELECTIVE,
      math: groupedClassifications.MATH_REQUIRED,
      cloud: [],
      genEd: [
        ...groupedClassifications.GEN_ED_REQUIRED,
        ...groupedClassifications.GEN_ED_ELECTIVE,
      ],
    };
    validationResult.completedMathRequirements = groupedClassifications.MATH_REQUIRED;
    validationResult.completedSupportingRequirements = groupedClassifications.SUPPORTING_REQUIRED;
    validationResult.completedGenEdRequirements = groupedClassifications.GEN_ED_REQUIRED;
    validationResult.completedGenEdElectives = groupedClassifications.GEN_ED_ELECTIVE;
    validationResult.completedFreeElectives = groupedClassifications.FREE_ELECTIVE;
    validationResult.completedOrProtectedCourses = recommendationState.completedOrProtectedCourses;
    validationResult.availableOptions = recommendationState.availableOptions;
    validationResult.recommendationCandidates = recommendationState.recommendationCandidates;

    let recommendedSchedule = buildFallbackSchedule({
      reference,
      requestedCourses,
      validation: validationResult,
    });
    let aiSummary = buildFallbackSummary({
      studentInfo: student,
      goals,
      requestedCourses,
      validation: validationResult,
    });

    try {
      aiSummary = await fetchVertexTranscriptSummary({
        studentInfo: student,
        requestedCourses,
        goals,
        validation: validationResult,
        reference,
      });
    } catch (vertexError) {
      console.error('Vertex summary error:', vertexError.message);
    }

    try {
      const vertexSchedule = await fetchVertexSchedulePlan({
        studentInfo: student,
        requestedCourses,
        goals,
        validation: validationResult,
        reference,
      });

      if (vertexSchedule.length > 0) {
        recommendedSchedule = vertexSchedule;
      }
    } catch (vertexError) {
      console.error('Vertex schedule error:', vertexError.message);
    }

    const transcriptId = `transcript_${Date.now()}`;
    const confirmationId = `confirmation_${Date.now()}`;

    await persistSession({
      student,
      confirmationId,
      classifiedCourses,
      validationSummary: {
        status: validationResult.status,
        completedCore: validationResult.completedCoreRequirements,
        completedMath: validationResult.completedMathRequirements,
      },
    });

    res.json({
      success: true,
      confirmation_id: confirmationId,
      transcript_id: transcriptId,
      fileName: transcriptFile.originalname,
      student,
      requestedCourses,
      goals,
      notes,
      validation: validationResult,
      termMarkers: validationResult.termMarkers || [],
      parsedDegreeWorksRows,
      classifiedCourses,
      availableOptions: recommendationState.availableOptions,
      aiSummary,
      recommendedSchedule,
      extractedCourses: validationResult.validCount,
      parsedCourses: [
        ...validationResult.completedCoreRequirements,
        ...validationResult.completedMathRequirements,
        ...validationResult.unknownCourses,
      ],
      bearCardUploaded: Boolean(bearCardFile),
    });
  } catch (error) {
    console.error('Submit error:', error);
    res.status(500).json({
      error: error.message || 'Advising submission failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  } finally {
    for (const file of [transcriptFile, bearCardFile]) {
      if (file?.path) {
        setTimeout(() => {
          fs.unlink(file.path, (err) => {
            if (err) console.error('Error deleting file:', err);
          });
        }, 1000);
      }
    }
  }
});

/**
 * POST /api/suggest-courses
 * Generate next-course suggestions using transcript results and Groq.
 */
app.post('/api/suggest-courses', async (req, res) => {
  try {
    const requestedCourses = Array.isArray(req.body?.courses) ? req.body.courses : [];
    const validation = req.body?.validation || {};
    const goals = req.body?.goals || '';
    const studentInfo = req.body?.studentInfo || {};

    const hasTranscriptContext =
      Array.isArray(validation?.missingCoreRequirements) ||
      Array.isArray(validation?.missingMathRequirements) ||
      Array.isArray(validation?.completedCoreRequirements) ||
      Array.isArray(validation?.completedMathRequirements);

    if (!hasTranscriptContext && requestedCourses.length === 0) {
      return res.json({ suggestions: [] });
    }

    const reference = await getCourseReferenceData();
    const fallbackSuggestions = buildFallbackSuggestions(reference, requestedCourses, validation);

    try {
      const suggestions = await fetchVertexSuggestions({
        requestedCourses,
        goals,
        studentInfo,
        validation,
        reference,
      });

      return res.json({
        suggestions: suggestions.length > 0 ? suggestions : fallbackSuggestions,
        source: suggestions.length > 0 ? 'vertex' : 'fallback',
      });
    } catch (vertexError) {
      console.error('Vertex suggestion error:', vertexError.message);
      return res.json({
        suggestions: fallbackSuggestions,
        source: 'fallback',
      });
    }
  } catch (error) {
    console.error('Suggest courses error:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate course suggestions',
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /api/courses/reference
 * Get the course reference data
 */
app.get('/api/courses/reference', async (req, res) => {
  try {
    const courseRef = await getCourseReferenceData();
    res.json(courseRef);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────
// Agentic & ingestion routes
// ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/bear-card/extract
 * Use Anthropic vision to extract student name + ID from Bear Card image.
 */
app.post('/api/bear-card/extract', upload.single('bearCard'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  if (!anthropic) return res.status(503).json({ error: 'Anthropic API not configured' });

  const supportedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!supportedTypes.has(req.file.mimetype)) {
    return res.json({ name: '', student_id: '', note: 'HEIC not supported for OCR — enter info manually.' });
  }

  try {
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64 = imageBuffer.toString('base64');

    const result = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: req.file.mimetype, data: base64 },
            },
            {
              type: 'text',
              text: "This is a Morgan State University Bear Card (student ID card). Extract the student's full name and student ID number. Return ONLY valid JSON with no markdown: {\"name\": \"First Last\", \"student_id\": \"123456789\"}. If you cannot read the card, return {\"name\": \"\", \"student_id\": \"\"}.",
            },
          ],
        },
      ],
    });

    const text = result.content[0]?.text || '';
    const parsed = extractJsonObject(text);

    res.json({
      name: String(parsed?.name || '').trim(),
      student_id: String(parsed?.student_id || '').trim(),
    });
  } catch (err) {
    console.error('Bear Card OCR error:', err.message);
    res.status(500).json({ error: 'Failed to extract Bear Card info' });
  } finally {
    if (req.file?.path) setTimeout(() => fs.unlink(req.file.path, () => {}), 1000);
  }
});

/**
 * POST /api/chat
 * Anthropic streaming chat with per-session transcript context.
 * Responds with text/event-stream (SSE).
 */
app.post('/api/chat', async (req, res) => {
  if (!anthropic) return res.status(503).json({ error: 'Anthropic API not configured' });

  const { sessionId, message, context } = req.body || {};
  if (!sessionId || !message?.trim()) {
    return res.status(400).json({ error: 'sessionId and message are required' });
  }

  if (!chatSessions.has(sessionId)) {
    chatSessions.set(sessionId, { messages: [], context: {} });
  }
  const session = chatSessions.get(sessionId);
  if (context) Object.assign(session.context, context);

  session.messages.push({ role: 'user', content: message.trim() });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    let fullResponse = '';

    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: buildChatSystemPrompt(session.context),
      messages: session.messages.slice(-20),
    });

    stream.on('text', (text) => {
      fullResponse += text;
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    });

    await stream.finalMessage();

    session.messages.push({ role: 'assistant', content: fullResponse });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Chat stream error:', err.message);
    res.write(`data: ${JSON.stringify({ error: 'Chat failed. Please try again.' })}\n\n`);
    res.end();
  }
});

/**
 * POST /api/audit
 * Degree audit agent using Anthropic tool use.
 */
app.post('/api/audit', async (req, res) => {
  if (!anthropic) return res.status(503).json({ error: 'Anthropic API not configured' });

  const { sessionId, student, validation } = req.body || {};
  if (!validation) return res.status(400).json({ error: 'validation data required' });

  try {
    const audit = await runAuditAgent({ student, validation });
    res.json({ success: true, audit, sessionId });
  } catch (err) {
    console.error('Audit agent error:', err.message);
    res.status(500).json({ error: err.message || 'Audit failed' });
  }
});

/**
 * POST /api/schedule-agent
 * Multi-semester schedule planning agent using Anthropic tool use.
 */
app.post('/api/schedule-agent', async (req, res) => {
  if (!anthropic) return res.status(503).json({ error: 'Anthropic API not configured' });

  const { sessionId, student, validation, goals, requestedCourses } = req.body || {};
  if (!validation) return res.status(400).json({ error: 'validation data required' });

  try {
    const reference = await getCourseReferenceData();
    const plan = await runScheduleAgent({ student, validation, reference, goals, requestedCourses });
    res.json({ success: true, plan, sessionId });
  } catch (err) {
    console.error('Schedule agent error:', err.message);
    res.status(500).json({ error: err.message || 'Schedule planning failed' });
  }
});

/**
 * GET /api/sessions/:netid
 * Return past advising sessions for a student (requires DB).
 */
app.get('/api/sessions/:netid', async (req, res) => {
  if (!db) return res.json({ sessions: [], note: 'DB not available' });

  try {
    const studentRes = await db.query(
      'SELECT id FROM students WHERE student_id = $1',
      [req.params.netid]
    );
    if (studentRes.rows.length === 0) return res.json({ sessions: [] });

    const sessionRes = await db.query(
      'SELECT id, started_at, summary FROM sessions WHERE student_id = $1 ORDER BY started_at DESC LIMIT 10',
      [studentRes.rows[0].id]
    );

    res.json({
      sessions: sessionRes.rows.map((row) => ({
        id: row.id,
        date: row.started_at,
        summary: safeParseJson(row.summary, {}),
      })),
    });
  } catch (err) {
    console.error('Sessions fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/submit-manual
 * Accept a manually entered list of courses, run the same analysis as /api/submit.
 */
app.post('/api/submit-manual', async (req, res) => {
  const { student, manualCourses, courses: requestedCourses, goals, notes } = req.body || {};

  if (!Array.isArray(manualCourses) || manualCourses.length === 0) {
    return res.status(400).json({ error: 'manualCourses array is required' });
  }

  try {
    const reference = await getCourseReferenceData();

    // Build a degreeWorksMatches map from the user-entered course list
    const degreeWorksMatches = new Map();
    for (const entry of manualCourses) {
      const code = normalizeSeedCourseCode(String(entry.code || ''));
      if (!code || isTranscriptTermMarker(code)) continue;
      degreeWorksMatches.set(code, {
        status: entry.status || 'COMPLETED',
        grade: entry.grade || '',
        term: entry.term || '',
        credits: entry.credits ?? null,
        confidence: 1,
        isValidCourse: true,
      });
    }

    const requirementOptionMatches = new Map();
    const courseUniverse = [...degreeWorksMatches.keys()];

    const classifiedCourses = courseUniverse.map((code) =>
      classifyCourse(code, null, { degreeWorksMatches, requirementOptionMatches })
    );

    const recommendationState = buildRecommendationState({
      classifiedCourses,
      requirementOptionMatches,
      reference,
    });

    const groupedClassifications = groupClassifiedCourses(classifiedCourses);
    const unclassifiedCourses = classifiedCourses
      .filter((c) => c.status === 'UNCLASSIFIED' || c.category === 'UNKNOWN')
      .map((c) => c.normalizedCourseCode);

    const coreCodes = Object.keys(reference?.core_cs_courses || {}).map(normalizeCourseCode);
    const mathCodes = Object.keys(reference?.math_requirements || {}).map(normalizeCourseCode);
    const completedCore = groupedClassifications.CS_CORE;
    const completedMath = groupedClassifications.MATH_REQUIRED;

    const validationResult = {
      totalFound: courseUniverse.length,
      validCount: courseUniverse.length - unclassifiedCourses.length,
      invalidCount: unclassifiedCourses.length,
      validationRate:
        courseUniverse.length > 0
          ? ((courseUniverse.length - unclassifiedCourses.length) / courseUniverse.length) * 100
          : 0,
      foundCourses: courseUniverse,
      unknownCourses: unclassifiedCourses,
      coursesByCategory: {
        core: completedCore,
        electives: groupedClassifications.FREE_ELECTIVE,
        math: completedMath,
        cloud: [],
        genEd: [
          ...groupedClassifications.GEN_ED_REQUIRED,
          ...groupedClassifications.GEN_ED_ELECTIVE,
        ],
      },
      completedCoreRequirements: completedCore,
      missingCoreRequirements: coreCodes.filter((c) => !completedCore.includes(c)),
      completedMathRequirements: completedMath,
      missingMathRequirements: mathCodes.filter((c) => !completedMath.includes(c)),
      completedSupportingRequirements: groupedClassifications.SUPPORTING_REQUIRED,
      completedGenEdRequirements: groupedClassifications.GEN_ED_REQUIRED,
      completedGenEdElectives: groupedClassifications.GEN_ED_ELECTIVE,
      completedFreeElectives: groupedClassifications.FREE_ELECTIVE,
      completedOrProtectedCourses: recommendationState.completedOrProtectedCourses,
      availableOptions: recommendationState.availableOptions,
      recommendationCandidates: recommendationState.recommendationCandidates,
      termMarkers: [],
      status: 'INCOMPLETE',
    };

    if (
      validationResult.missingCoreRequirements.length === 0 &&
      validationResult.missingMathRequirements.length === 0 &&
      unclassifiedCourses.length === 0
    ) {
      validationResult.status = 'COMPLETE';
    } else if (unclassifiedCourses.length > 0) {
      validationResult.status = 'INVALID_COURSES_FOUND';
    }

    let recommendedSchedule = buildFallbackSchedule({ reference, requestedCourses, validation: validationResult });
    let aiSummary = buildFallbackSummary({ studentInfo: student, goals, requestedCourses, validation: validationResult });

    try {
      aiSummary = await fetchVertexTranscriptSummary({ studentInfo: student, requestedCourses, goals, validation: validationResult, reference });
    } catch (e) {
      console.error('Vertex summary error (manual):', e.message);
    }

    try {
      const vertexSchedule = await fetchVertexSchedulePlan({ studentInfo: student, requestedCourses, goals, validation: validationResult, reference });
      if (vertexSchedule.length > 0) recommendedSchedule = vertexSchedule;
    } catch (e) {
      console.error('Vertex schedule error (manual):', e.message);
    }

    const confirmationId = `confirmation_${Date.now()}`;
    const transcriptId = `manual_${Date.now()}`;

    await persistSession({
      student,
      confirmationId,
      classifiedCourses,
      validationSummary: { status: validationResult.status, completedCore, completedMath },
    });

    res.json({
      success: true,
      confirmation_id: confirmationId,
      transcript_id: transcriptId,
      fileName: 'Manual Entry',
      student,
      requestedCourses,
      goals,
      notes,
      validation: validationResult,
      termMarkers: [],
      parsedDegreeWorksRows: [],
      classifiedCourses,
      availableOptions: recommendationState.availableOptions,
      aiSummary,
      recommendedSchedule,
      extractedCourses: validationResult.validCount,
      parsedCourses: [...completedCore, ...completedMath],
      bearCardUploaded: false,
      inputMode: 'manual',
    });
  } catch (err) {
    console.error('Manual submit error:', err.message);
    res.status(500).json({ error: err.message || 'Manual submission failed' });
  }
});

// Error handling middleware
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: err.message || 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`🚀 Backend server running on http://${HOST}:${PORT}`);
  console.log(`📝 Transcript upload endpoint: POST /api/upload-transcript`);
  console.log(`✅ Health check: GET /api/health`);
});
// patched at bottom — override extractPdfText to use pdf-parser service
