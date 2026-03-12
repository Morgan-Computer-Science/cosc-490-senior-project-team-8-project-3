import degreeRequirements from './morgan-state-cs-bs.seed.json' with { type: 'json' };

const seedIndex = buildSeedIndex(degreeRequirements);
const ALLOWED_DEPARTMENT_PREFIXES = new Set([
  'COSC',
  'CLCO',
  'MATH',
  'ENGL',
  'ORNS',
  'FIN',
  'MIND',
  'COMM',
  'RDG',
  'WGST',
  'TRSS',
  'MUSC',
  'HLTH',
  'ALCR',
  'BUAD',
  'INSS',
  'EEGR',
  'PHYS',
  'CHEM',
  'BIOL',
  'ECON',
  'PSYC',
  'SOCI',
  'HIST',
  'PHIL',
  'ART',
]);
const PASSING_GRADES = new Set(['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'P', 'S']);
const NON_COMPLETED_GRADES = new Set(['D', 'D+', 'D-', 'F', 'W', 'WF', 'WP', 'I']);
const TERM_PATTERN = /\b(FALL|SPRING|SUMMER|WINTER)\s+20\d{2}\b/i;

export { degreeRequirements, ALLOWED_DEPARTMENT_PREFIXES };

export function normalizeCourseCode(courseCode) {
  return String(courseCode || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function isTranscriptTermMarker(courseCode) {
  const normalizedCode = normalizeCourseCode(courseCode);
  return /^(FALL|SPRING|SUMMER|WINTER)\d{4}$/.test(normalizedCode);
}

export function parseDegreeWorksCourseRows(text) {
  const lines = String(text || '').split(/\r?\n/);
  const parsedRows = [];
  let currentSection = null;
  let inStillNeededBlock = false;

  for (const rawLine of lines) {
    const line = rawLine.trim().replace(/\s+/g, ' ');
    if (!line) continue;

    const upperLine = line.toUpperCase();
    const detectedSection = detectSectionHeader(upperLine);
    if (detectedSection) {
      currentSection = detectedSection;
      inStillNeededBlock = false;
      continue;
    }

    if (upperLine.includes('STILL NEEDED')) {
      inStillNeededBlock = true;
      continue;
    }

    if (/\b(COMPLETE[D]?|SATISFIED|IN-PROGRESS|IN PROGRESS|FREE ELECTIVES|GENERAL EDUCATION PROGRAM|COMPUTER SCIENCE REQUIREMENTS|COMPUTER SCIENCE SUPPORTING COURSES)\b/.test(upperLine)) {
      inStillNeededBlock = false;
    }

    const row = parseDegreeWorksCourseLine(line, currentSection, inStillNeededBlock);
    if (row) parsedRows.push(row);
  }

  return dedupeCourseRows(parsedRows);
}

export function parseRequirementOptionText(text) {
  const lines = String(text || '').split(/\r?\n/);
  const options = new Map();
  let activeRequirementLine = null;

  for (const rawLine of lines) {
    const line = rawLine.trim().replace(/\s+/g, ' ');
    if (!line) continue;

    const upperLine = line.toUpperCase();
    if (upperLine.includes('STILL NEEDED')) {
      activeRequirementLine = line;
      collectOptionCourses(line, options);
      continue;
    }

    if (activeRequirementLine && /\b(OR|AND|1 CLASS|2 CLASSES|CHOOSE|SELECT)\b/i.test(line)) {
      collectOptionCourses(line, options, activeRequirementLine);
      continue;
    }

    if (detectSectionHeader(upperLine) || /\b(COMPLETE[D]?|SATISFIED|IN-PROGRESS|IN PROGRESS)\b/.test(upperLine)) {
      activeRequirementLine = null;
    }
  }

  return options;
}

export function parseDegreeWorksSatisfiedBlocks(text) {
  const matchedCourses = new Map();
  const parsedRows = parseDegreeWorksCourseRows(text);

  for (const row of parsedRows) {
    const mappedGroup = inferRequirementGroup((row.section || '').toUpperCase()) || inferCategoryFromCode(row.courseCode, row.courseTitle)?.requirementGroup;
    const mappedCategory = mapRequirementGroupToCategory(mappedGroup, row.courseCode);

    matchedCourses.set(row.courseCode, {
      normalizedCourseCode: row.courseCode,
      matchedRequirement: mappedGroup ? `${mappedGroup} matched in Degree Works` : 'Matched in Degree Works',
      requirementGroup: mappedGroup,
      category: mappedCategory,
      status: row.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'SATISFIED',
      sourceOfMatch: 'DEGREE_WORKS',
      sourceType: row.status === 'IN_PROGRESS' ? 'DEGREE_WORKS_IN_PROGRESS' : 'DEGREE_WORKS_SATISFIED',
      courseName: row.courseTitle || null,
      grade: row.grade,
      credits: row.credits,
      term: row.term,
      section: row.section,
      isValidCourse: row.isValidCourse,
      confidence: row.confidence,
    });
  }

  return matchedCourses;
}

export function classifyCourse(courseCode, courseName = '', options = {}) {
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  const normalizedName = String(courseName || '').trim();
  const degreeWorksMatch = options.degreeWorksMatches?.get?.(normalizedCourseCode) || null;
  const requirementOptionMatch = options.requirementOptionMatches?.get?.(normalizedCourseCode) || null;
  const seedMatch = seedIndex.get(normalizedCourseCode) || inferCategoryFromCode(normalizedCourseCode, normalizedName);

  if (!normalizedCourseCode) {
    return buildUnclassifiedCourse(normalizedCourseCode, normalizedName);
  }

  if (isTranscriptTermMarker(normalizedCourseCode)) {
    return {
      normalizedCourseCode,
      courseName: normalizedName || null,
      category: 'TRANSCRIPT_TERM',
      matchedRequirement: 'Transcript term marker',
      requirementGroup: null,
      status: 'COMPLETED',
      sourceOfMatch: 'NONE',
      sourceType: 'TRANSCRIPT_ROW',
      grade: null,
      credits: null,
      term: null,
      section: null,
      isValidCourse: false,
      confidence: 1,
    };
  }

  if (seedMatch && degreeWorksMatch) {
    return {
      normalizedCourseCode,
      courseName: normalizedName || seedMatch.courseName || degreeWorksMatch.courseName || null,
      category: seedMatch.category || degreeWorksMatch.category || 'UNKNOWN',
      matchedRequirement: seedMatch.matchedRequirement || degreeWorksMatch.matchedRequirement,
      requirementGroup: seedMatch.requirementGroup || degreeWorksMatch.requirementGroup || null,
      status: degreeWorksMatch.status || 'SATISFIED',
      sourceOfMatch: 'BOTH',
      sourceType: degreeWorksMatch.status === 'IN_PROGRESS' ? 'DEGREE_WORKS_IN_PROGRESS' : 'DEGREE_WORKS_SATISFIED',
      grade: degreeWorksMatch.grade || null,
      credits: degreeWorksMatch.credits ?? null,
      term: degreeWorksMatch.term || null,
      section: degreeWorksMatch.section || null,
      isValidCourse: degreeWorksMatch.isValidCourse ?? true,
      confidence: degreeWorksMatch.confidence ?? 1,
    };
  }

  if (requirementOptionMatch && !degreeWorksMatch) {
    return {
      normalizedCourseCode,
      courseName: normalizedName || requirementOptionMatch.courseTitle || seedMatch?.courseName || null,
      category: requirementOptionMatch.category || seedMatch?.category || 'FREE_ELECTIVE',
      matchedRequirement: requirementOptionMatch.matchedRequirement,
      requirementGroup: requirementOptionMatch.requirementGroup,
      status: 'AVAILABLE_OPTION',
      sourceOfMatch: 'REQUIREMENT_OPTION_TEXT',
      sourceType: 'REQUIREMENT_OPTION_TEXT',
      grade: null,
      credits: null,
      term: null,
      section: requirementOptionMatch.section || null,
      isValidCourse: true,
      confidence: requirementOptionMatch.confidence ?? 0.7,
    };
  }

  if (seedMatch) {
    return {
      normalizedCourseCode,
      courseName: normalizedName || seedMatch.courseName || null,
      category: seedMatch.category,
      matchedRequirement: seedMatch.matchedRequirement,
      requirementGroup: seedMatch.requirementGroup,
      status: degreeWorksMatch?.status || 'IN_PROGRESS',
      sourceOfMatch: 'CURRICULUM_SEED',
      sourceType: degreeWorksMatch?.sourceType || 'CURRICULUM_SEED',
      grade: degreeWorksMatch?.grade || null,
      credits: degreeWorksMatch?.credits ?? null,
      term: degreeWorksMatch?.term || null,
      section: degreeWorksMatch?.section || null,
      isValidCourse: degreeWorksMatch?.isValidCourse ?? true,
      confidence: degreeWorksMatch?.confidence ?? 0.8,
    };
  }

  if (degreeWorksMatch) {
    return {
      normalizedCourseCode,
      courseName: normalizedName || degreeWorksMatch.courseName || null,
      category: degreeWorksMatch.category || 'FREE_ELECTIVE',
      matchedRequirement: degreeWorksMatch.matchedRequirement,
      requirementGroup: degreeWorksMatch.requirementGroup,
      status: degreeWorksMatch.status || 'SATISFIED',
      sourceOfMatch: 'DEGREE_WORKS',
      sourceType: degreeWorksMatch.sourceType || 'DEGREE_WORKS_SATISFIED',
      grade: degreeWorksMatch.grade || null,
      credits: degreeWorksMatch.credits ?? null,
      term: degreeWorksMatch.term || null,
      section: degreeWorksMatch.section || null,
      isValidCourse: degreeWorksMatch.isValidCourse ?? true,
      confidence: degreeWorksMatch.confidence ?? 0.75,
    };
  }

  return buildUnclassifiedCourse(normalizedCourseCode, normalizedName);
}

function buildUnclassifiedCourse(normalizedCourseCode, courseName) {
  return {
    normalizedCourseCode,
    courseName: courseName || null,
    category: 'UNKNOWN',
    matchedRequirement: null,
    requirementGroup: null,
    status: 'UNCLASSIFIED',
    sourceOfMatch: 'NONE',
    sourceType: 'TRANSCRIPT_ROW',
    grade: null,
    credits: null,
    term: null,
    section: null,
    isValidCourse: false,
    confidence: 0,
  };
}

function buildSeedIndex(seedData) {
  const index = new Map();

  const addEntry = (courseCode, entry) => {
    if (!courseCode) return;
    index.set(normalizeCourseCode(courseCode), entry);
  };

  for (const requirement of seedData.requirements.csCore) {
    addEntry(requirement.courseCode, {
      category: requirement.category,
      matchedRequirement: requirement.courseName,
      requirementGroup: requirement.requirementGroup,
      isRequired: requirement.isRequired,
      courseName: requirement.courseName,
    });
  }

  for (const requirement of seedData.requirements.supportingRequired) {
    addEntry(requirement.courseCode, {
      category: requirement.category,
      matchedRequirement: requirement.courseName,
      requirementGroup: requirement.requirementGroup,
      isRequired: requirement.isRequired,
      courseName: requirement.courseName,
    });
  }

  for (const requirement of seedData.requirements.mathRequired) {
    addEntry(requirement.courseCode, {
      category: requirement.category,
      matchedRequirement: requirement.courseName,
      requirementGroup: requirement.requirementGroup,
      isRequired: requirement.isRequired,
      courseName: requirement.courseName,
    });
  }

  for (const requirement of seedData.requirements.genEdRequired) {
    if (Array.isArray(requirement.courseOptions)) {
      for (const option of requirement.courseOptions) {
        addEntry(option.courseCode, {
          category: requirement.category,
          matchedRequirement: requirement.requirementName,
          requirementGroup: requirement.requirementGroup,
          isRequired: requirement.isRequired,
          courseName: option.courseName,
        });
      }
    } else {
      addEntry(requirement.courseCode, {
        category: requirement.category,
        matchedRequirement: requirement.courseName || requirement.requirementName,
        requirementGroup: requirement.requirementGroup,
        isRequired: requirement.isRequired,
        courseName: requirement.courseName,
      });
    }
  }

  for (const requirement of seedData.requirements.genEdElectives) {
    for (const option of requirement.courseOptions || []) {
      addEntry(option.courseCode, {
        category: requirement.category,
        matchedRequirement: requirement.requirementName,
        requirementGroup: requirement.requirementGroup,
        isRequired: requirement.isRequired,
        courseName: option.courseName,
      });
    }
  }

  return index;
}

function inferRequirementGroup(line) {
  if (!line) return null;
  if (line.includes('GENERAL EDUCATION PROGRAM')) return 'GEN_ED_REQUIRED';
  if (line.includes('COMPUTER SCIENCE SUPPORTING COURSES')) return 'SUPPORTING_REQUIRED';
  if (line.includes('COMPUTER SCIENCE REQUIREMENTS')) return 'CS_CORE';
  if (line.includes('FREE ELECTIVES')) return 'FREE_ELECTIVE';
  if (line.includes('IN-PROGRESS') || line.includes('IN PROGRESS')) return 'IN_PROGRESS';
  if (line.includes('MATH')) return 'MATH_REQUIRED';
  if (line.includes('HH')) return 'HH';
  if (line.includes('AH')) return 'AH';
  if (line.includes('BP')) return line.includes('LAB') ? 'BP_WITH_LAB' : 'BP_WITHOUT_LAB';
  if (line.includes('SB')) return 'SB';
  if (line.includes('CI')) return 'CI';
  if (line.includes('CT')) return 'CT';
  if (line.includes('ORNS')) return 'ORIENTATION';
  return null;
}

function mapRequirementGroupToCategory(requirementGroup, courseCode) {
  if (requirementGroup === 'CS_CORE') return 'CS_CORE';
  if (requirementGroup === 'SUPPORTING_REQUIRED') return 'SUPPORTING_REQUIRED';
  if (requirementGroup === 'MATH_REQUIRED') return 'MATH_REQUIRED';
  if (['GEN_ED_REQUIRED', 'COMPOSITION_1', 'COMPOSITION_2', 'ORIENTATION', 'QUANTITATIVE', 'MAJOR_GATEWAY'].includes(requirementGroup)) return 'GEN_ED_REQUIRED';
  if (['HH', 'AH', 'BP_WITH_LAB', 'BP_WITHOUT_LAB', 'SB', 'CI', 'CT', 'WELLNESS'].includes(requirementGroup)) return 'GEN_ED_ELECTIVE';
  if (requirementGroup === 'FREE_ELECTIVE') return 'FREE_ELECTIVE';
  return inferCategoryFromCode(courseCode)?.category || 'FREE_ELECTIVE';
}

function inferCategoryFromCode(courseCode, courseName = '') {
  const normalizedCourseCode = normalizeCourseCode(courseCode);
  const normalizedName = String(courseName || '').toLowerCase();

  if (!normalizedCourseCode) return null;

  if (normalizedCourseCode.startsWith('MATH')) {
    return {
      category: 'MATH_REQUIRED',
      matchedRequirement: 'Math requirement pattern match',
      requirementGroup: 'MATH_REQUIRED',
      courseName: null,
    };
  }

  if (normalizedCourseCode === 'FIN101' || normalizedCourseCode === 'MIND101') {
    return {
      category: 'GEN_ED_ELECTIVE',
      matchedRequirement: 'Physical Activity or FIN 101 or MIND 101',
      requirementGroup: 'WELLNESS',
      courseName: null,
    };
  }

  if (normalizedCourseCode.startsWith('COSC') || normalizedCourseCode.startsWith('CLCO')) {
    return {
      category: 'FREE_ELECTIVE',
      matchedRequirement: 'Course not yet mapped to a specific seed requirement',
      requirementGroup: 'FREE_ELECTIVE',
      courseName: null,
    };
  }

  if (isGenEdPattern(normalizedCourseCode, normalizedName)) {
    return {
      category: 'GEN_ED_ELECTIVE',
      matchedRequirement: 'General education pattern match',
      requirementGroup: null,
      courseName: null,
    };
  }

  return null;
}

function isGenEdPattern(normalizedCourseCode, normalizedName) {
  const prefixes = ['ENGL', 'COMM', 'RDG', 'WGST', 'MUSC', 'TRSS', 'HLTH', 'ALCR', 'BUAD', 'INSS', 'EEGR'];
  return prefixes.some((prefix) => normalizedCourseCode.startsWith(prefix))
    || normalizedName.includes('composition')
    || normalizedName.includes('reading')
    || normalizedName.includes('communication');
}

function detectSectionHeader(line) {
  if (line.includes('GENERAL EDUCATION PROGRAM')) return 'General Education Program';
  if (line.includes('COMPUTER SCIENCE SUPPORTING COURSES')) return 'Computer Science Supporting Courses';
  if (line.includes('COMPUTER SCIENCE REQUIREMENTS')) return 'Computer Science Requirements';
  if (line.includes('FREE ELECTIVES')) return 'Free Electives';
  if (line.includes('IN-PROGRESS') || line.includes('IN PROGRESS')) return 'In-progress';
  return null;
}

function collectOptionCourses(line, options, parentRequirementLine = line) {
  const matches = line.match(/\b([A-Z]{2,5})\s*-?\s*(\d{3,4})\b/g) || [];
  for (const rawCode of matches) {
    const normalizedCode = normalizeCourseCode(rawCode);
    const prefix = normalizedCode.replace(/\d+$/, '');
    if (!ALLOWED_DEPARTMENT_PREFIXES.has(prefix)) continue;
    if (isTranscriptTermMarker(normalizedCode)) continue;

    const inferred = inferCategoryFromCode(normalizedCode) || {};
    options.set(normalizedCode, {
      normalizedCourseCode: normalizedCode,
      courseTitle: null,
      matchedRequirement: parentRequirementLine,
      requirementGroup: inferred.requirementGroup || 'FREE_ELECTIVE',
      category: inferred.category || 'FREE_ELECTIVE',
      section: 'Still Needed Requirement Options',
      confidence: 0.65,
    });
  }
}

function parseDegreeWorksCourseLine(line, currentSection, inStillNeededBlock) {
  const codeMatch = line.match(/\b([A-Z]{2,5})\s*-?\s*(\d{3,4})\b/);
  if (!codeMatch) return null;

  const prefix = codeMatch[1].toUpperCase();
  const courseCode = `${prefix}${codeMatch[2]}`;
  if (!ALLOWED_DEPARTMENT_PREFIXES.has(prefix)) return null;
  if (isTranscriptTermMarker(courseCode)) return null;
  if (inStillNeededBlock && !looksLikeCourseRow(line)) return null;

  const statusToken = extractStatusToken(line);
  const grade = extractGrade(line);
  const term = extractTerm(line);
  const credits = extractCredits(line);
  const courseTitle = extractCourseTitle(line, codeMatch[0], statusToken, grade, term, credits);

  if (!statusToken && !grade && credits == null && !term) return null;

  return {
    courseCode,
    courseTitle,
    status: deriveCourseStatus(statusToken, grade),
    grade,
    credits,
    term,
    section: currentSection,
    isValidCourse: true,
    confidence: scoreRowConfidence({ courseTitle, statusToken, grade, term, credits, currentSection }),
  };
}

function looksLikeCourseRow(line) {
  return /\b[A-Z]{2,5}\s*-?\s*\d{3,4}\b/.test(line)
    && (extractStatusToken(line) || extractGrade(line) || extractCredits(line) != null || extractTerm(line));
}

function extractStatusToken(line) {
  const statusMatch = line.match(/\b(IP|IN PROGRESS|IN-PROGRESS)\b/i);
  return statusMatch ? statusMatch[1].toUpperCase().replace(/\s+/g, '_') : null;
}

function extractGrade(line) {
  const gradeMatch = line.match(/\b(A-|A|B\+|B-|B|C\+|C|D\+|D-|D|F|W|WF|WP|P|S|I)\b/);
  return gradeMatch ? gradeMatch[1].toUpperCase() : null;
}

function extractTerm(line) {
  const termMatch = line.match(TERM_PATTERN);
  return termMatch ? termMatch[0].toUpperCase() : null;
}

function extractCredits(line) {
  const numbers = [...line.matchAll(/\b(\d+(?:\.\d+)?)\b/g)].map((match) => Number(match[1]));
  const creditValue = numbers.find((value) => value > 0 && value <= 6);
  return Number.isFinite(creditValue) ? creditValue : null;
}

function extractCourseTitle(line, rawCode, statusToken, grade, term, credits) {
  let title = line.replace(rawCode, ' ');
  for (const token of [statusToken, grade, term, credits != null ? String(credits) : null]) {
    if (!token) continue;
    title = title.replace(token, ' ');
  }
  return title.replace(/\s+/g, ' ').trim() || null;
}

function deriveCourseStatus(statusToken, grade) {
  if (statusToken === 'IP' || statusToken === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (grade && PASSING_GRADES.has(grade)) return 'COMPLETED';
  if (grade && NON_COMPLETED_GRADES.has(grade)) return 'UNCLASSIFIED';
  return 'UNCLASSIFIED';
}

function scoreRowConfidence({ courseTitle, statusToken, grade, term, credits, currentSection }) {
  let score = 0.4;
  if (courseTitle) score += 0.15;
  if (statusToken || grade) score += 0.15;
  if (term) score += 0.1;
  if (credits != null) score += 0.1;
  if (currentSection) score += 0.1;
  return Math.min(1, Number(score.toFixed(2)));
}

function dedupeCourseRows(rows) {
  const byCode = new Map();
  for (const row of rows) {
    const existing = byCode.get(row.courseCode);
    if (!existing || row.confidence > existing.confidence || row.status === 'IN_PROGRESS') {
      byCode.set(row.courseCode, row);
    }
  }
  return [...byCode.values()];
}
