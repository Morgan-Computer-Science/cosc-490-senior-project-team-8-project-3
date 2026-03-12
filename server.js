// Node.js Backend Server - integrates React frontend with Python transcript validation
// Entry point: node server.js

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawn } from 'child_process';
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
const DEFAULT_GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

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

async function fetchGroqTranscriptSummary({ studentInfo, requestedCourses, goals, validation, reference }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GROQ_API_KEY');
  }

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

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_GROQ_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'You are a precise academic advising assistant. Output JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq summary request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || '';
  const parsed = extractJsonObject(text);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Groq returned non-JSON summary');
  }

  return {
    headline: String(parsed.headline || '').trim(),
    summary: String(parsed.summary || '').trim(),
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map((item) => String(item).trim()).filter(Boolean).slice(0, 4) : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks.map((item) => String(item).trim()).filter(Boolean).slice(0, 4) : [],
    source: 'groq',
  };
}

async function fetchGroqSuggestions({ requestedCourses, goals, studentInfo, validation, reference }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GROQ_API_KEY');
  }

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

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_GROQ_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'You are a precise academic advising assistant. Output JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || '';
  const parsed = extractJsonArray(text);

  if (!Array.isArray(parsed)) {
    throw new Error('Groq returned non-JSON suggestions');
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

async function fetchGroqSchedulePlan({ requestedCourses, goals, studentInfo, validation, reference }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GROQ_API_KEY');
  }

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

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_GROQ_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'You are a precise academic advising assistant. Output JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq schedule request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || '';
  const parsed = extractJsonArray(text);

  if (!Array.isArray(parsed)) {
    throw new Error('Groq returned non-JSON schedule');
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
      aiSummary = await fetchGroqTranscriptSummary({
        studentInfo: student,
        requestedCourses,
        goals,
        validation: validationResult,
        reference,
      });
    } catch (groqError) {
      console.error('Groq summary error:', groqError.message);
    }

    try {
      const groqSchedule = await fetchGroqSchedulePlan({
        studentInfo: student,
        requestedCourses,
        goals,
        validation: validationResult,
        reference,
      });

      if (groqSchedule.length > 0) {
        recommendedSchedule = groqSchedule;
      }
    } catch (groqError) {
      console.error('Groq schedule error:', groqError.message);
    }

    const transcriptId = `transcript_${Date.now()}`;
    const confirmationId = `confirmation_${Date.now()}`;

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
      const suggestions = await fetchGroqSuggestions({
        requestedCourses,
        goals,
        studentInfo,
        validation,
        reference,
      });

      return res.json({
        suggestions: suggestions.length > 0 ? suggestions : fallbackSuggestions,
        source: suggestions.length > 0 ? 'groq' : 'fallback',
      });
    } catch (groqError) {
      console.error('Groq suggestion error:', groqError.message);
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
