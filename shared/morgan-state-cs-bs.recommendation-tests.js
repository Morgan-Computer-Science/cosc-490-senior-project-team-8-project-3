import {
  classifyCourse,
  parseDegreeWorksCourseRows,
  parseDegreeWorksSatisfiedBlocks,
  parseRequirementOptionText,
} from './morgan-state-cs-bs.js';

const text = `
Computer Science Requirements
COSC 351 Cybersecurity A 3 FALL 2024
Free Electives
COSC 332 Game Design A 3 FALL 2023
In-progress
MATH 313 Differential Equations IP 3 SPRING 2026
Still needed: 1 Class in BUAD 326 or INSS 391 or EEGR 481
`;

const degreeWorksMatches = parseDegreeWorksSatisfiedBlocks(text);
const optionMatches = parseRequirementOptionText(text);
const parsedRows = parseDegreeWorksCourseRows(text);

const results = [
  classifyCourse('COSC351', 'Cybersecurity', { degreeWorksMatches, requirementOptionMatches: optionMatches }),
  classifyCourse('COSC332', 'Introduction to Game Design and Development', { degreeWorksMatches, requirementOptionMatches: optionMatches }),
  classifyCourse('MATH313', 'Differential Equations', { degreeWorksMatches, requirementOptionMatches: optionMatches }),
  classifyCourse('BUAD326', 'Business Communications', { degreeWorksMatches, requirementOptionMatches: optionMatches }),
  classifyCourse('INSS391', 'Information Systems', { degreeWorksMatches, requirementOptionMatches: optionMatches }),
];

console.log({ parsedRows, results, optionMatches: [...optionMatches.values()] });
