import {
  classifyCourse,
  degreeRequirements,
  normalizeCourseCode,
  parseDegreeWorksCourseRows,
  parseDegreeWorksSatisfiedBlocks,
} from './morgan-state-cs-bs.js';

const degreeWorksText = `
  General Education Program
  ORNS 106 Orientation A 1 FALL 2021
  FIN 101 Financial Literacy B 3 FALL 2022
  Computer Science Supporting Courses
  COSC 201 Computer Ethics A 3 FALL 2022
  In-progress
  COSC 459 Database Design IP 3 SPRING 2026
  COSC 490 Senior Project IP 3 SPRING 2026
  MATH 313 Differential Equations IP 3 SPRING 2026
  CLCO 471 Data Analytics in the Cloud IP 3 SPRING 2026
  OR494 bogus artifact
  OR483 bogus artifact
  OF120 bogus artifact
`;

const parsedRows = parseDegreeWorksCourseRows(degreeWorksText);
const degreeWorksMatches = parseDegreeWorksSatisfiedBlocks(degreeWorksText);

const transcriptSamples = [
  { courseCode: 'COSC201', courseName: 'Computer Ethics' },
  { courseCode: 'ORNS106', courseName: 'Orientation' },
  { courseCode: 'FIN101', courseName: 'Financial Literacy' },
  { courseCode: 'MATH113', courseName: 'College Algebra' },
  { courseCode: 'MATH114', courseName: 'Trigonometry' },
  { courseCode: 'COMM203', courseName: 'Public Speaking' },
  { courseCode: 'RDG101', courseName: 'Reading Improvement' },
];

console.log('Program:', degreeRequirements.program.programName);
console.log('Parsed rows:', parsedRows);

for (const sample of transcriptSamples) {
  console.log({
    input: sample.courseCode,
    normalized: normalizeCourseCode(sample.courseCode),
    result: classifyCourse(sample.courseCode, sample.courseName, { degreeWorksMatches }),
  });
}
