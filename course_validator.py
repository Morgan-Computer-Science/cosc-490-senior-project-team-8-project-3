# Course Code/Title Reference Map and Validation Tool
# This script stores a course reference map and validates extracted transcript text

import re
from typing import Dict, List, Tuple

# Course Reference Map: Maps course codes to course titles
# This is extracted from the curriculum PDF (Degree Works)
# Format: "COURSE_CODE": "Course Title"
COURSE_REFERENCE_MAP = {
    # Example courses - update this with actual courses from your curriculum PDF
    "MATH101": "Calculus I",
    "MATH102": "Calculus II",
    "MATH201": "Linear Algebra",
    "CS110": "Introduction to Computer Science",
    "CS210": "Data Structures",
    "CS310": "Algorithms",
    "PHYS101": "Physics I",
    "PHYS102": "Physics II",
    "CHEM101": "Chemistry I",
    "CHEM102": "Chemistry II",
    "ENG101": "English Composition",
    "ENG201": "Literature",
    "HIST101": "World History",
    "PSYCH101": "Introduction to Psychology",
    "BIO101": "Biology I",
    "BIO102": "Biology II",
}


def load_course_map_from_file(filename: str) -> Dict[str, str]:
    """
    Load course reference map from an external file.
    
    File format (one per line): COURSECODE|CourseTitle
    Example: MATH101|Calculus I
    
    Args:
        filename (str): Path to the course map file
        
    Returns:
        Dict[str, str]: Dictionary mapping course codes to titles
    """
    course_map = {}
    try:
        with open(filename, 'r') as f:
            for line in f:
                line = line.strip()
                if line and '|' in line:
                    parts = line.split('|', 1)
                    course_code = parts[0].strip().upper()
                    course_title = parts[1].strip()
                    course_map[course_code] = course_title
        print(f"Loaded {len(course_map)} courses from {filename}")
        return course_map
    except FileNotFoundError:
        print(f"Error: File '{filename}' not found.")
        return {}


def extract_course_codes(text: str) -> List[str]:
    """
    Extract course codes from transcript text.
    
    Uses regex to find patterns like SUBJ123, SUBJ 123, etc.
    
    Args:
        text (str): Extracted transcript text
        
    Returns:
        List[str]: List of course codes found (uppercase)
    """
    # Pattern: 2-4 letters followed by optional space and 3-4 digits
    # Example: MATH101, CS 310, PHYS 102
    pattern = r'\b([A-Z]{2,4})\s*(\d{3,4})\b'
    
    matches = re.findall(pattern, text)
    
    # Combine letter and number parts into course codes
    course_codes = [f"{code}{number}" for code, number in matches]
    
    # Remove duplicates and sort
    course_codes = sorted(list(set(course_codes)))
    
    return course_codes


def validate_courses(text: str, course_map: Dict[str, str] = None) -> Dict:
    """
    Validate extracted transcript text against the course reference map.
    
    Args:
        text (str): Extracted transcript text
        course_map (Dict[str, str]): Course reference map (uses global if not provided)
        
    Returns:
        Dict: Validation results including found, valid, and invalid courses
    """
    if course_map is None:
        course_map = COURSE_REFERENCE_MAP
    
    # Extract course codes from text
    found_courses = extract_course_codes(text)
    
    # Separate into valid and invalid courses
    valid_courses = []
    invalid_courses = []
    
    for course_code in found_courses:
        if course_code in course_map:
            valid_courses.append({
                'code': course_code,
                'title': course_map[course_code]
            })
        else:
            invalid_courses.append(course_code)
    
    # Create results dictionary
    results = {
        'total_found': len(found_courses),
        'valid_courses': valid_courses,
        'valid_count': len(valid_courses),
        'invalid_courses': invalid_courses,
        'invalid_count': len(invalid_courses),
        'validation_percentage': (len(valid_courses) / len(found_courses) * 100) if found_courses else 0
    }
    
    return results


def print_validation_report(results: Dict) -> None:
    """
    Print a formatted validation report.
    
    Args:
        results (Dict): Validation results from validate_courses()
    """
    print("\n" + "="*60)
    print("COURSE VALIDATION REPORT")
    print("="*60)
    
    print(f"\nTotal Courses Found: {results['total_found']}")
    print(f"Valid Courses: {results['valid_count']}")
    print(f"Invalid/Unknown Courses: {results['invalid_count']}")
    print(f"Validation Rate: {results['validation_percentage']:.1f}%")
    
    if results['valid_courses']:
        print("\n" + "-"*60)
        print("VALID COURSES (Found in Reference Map)")
        print("-"*60)
        for course in results['valid_courses']:
            print(f"  {course['code']:12} → {course['title']}")
    
    if results['invalid_courses']:
        print("\n" + "-"*60)
        print("INVALID/UNKNOWN COURSES (Not in Reference Map)")
        print("-"*60)
        for course_code in results['invalid_courses']:
            print(f"  {course_code}")
    
    print("\n" + "="*60 + "\n")


def check_transcript_against_curriculum(transcript_text: str, curriculum_map: Dict[str, str] = None) -> bool:
    """
    Check if all courses in a transcript are in the curriculum.
    
    Args:
        transcript_text (str): Extracted transcript text
        curriculum_map (Dict[str, str]): Curriculum course map
        
    Returns:
        bool: True if all courses are valid, False otherwise
    """
    results = validate_courses(transcript_text, curriculum_map)
    return results['invalid_count'] == 0


if __name__ == "__main__":
    import sys
    
    # Example usage
    print("Course Validator Tool\n")
    print(f"Total courses in reference map: {len(COURSE_REFERENCE_MAP)}\n")
    
    # Example transcript text
    sample_transcript = """
    Student Transcript
    
    MATH101 - Calculus I - Grade: A
    CS110 - Introduction to Computer Science - Grade: B+
    PHYS101 - Physics I - Grade: A-
    CHEM101 - Chemistry I - Grade: B
    UNKNOWN301 - Unknown Course - Grade: A
    MATH102 - Calculus II - Grade: A
    """
    
    print("Sample Transcript:")
    print(sample_transcript)
    
    # Validate the transcript
    results = validate_courses(sample_transcript)
    print_validation_report(results)
    
    # Check if all courses are in curriculum
    all_valid = check_transcript_against_curriculum(sample_transcript)
    if all_valid:
        print("✓ All courses are in the curriculum!")
    else:
        print("✗ Some courses are not in the curriculum. Check the report above.")
