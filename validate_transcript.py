# Integration script: Extract PDF text and validate courses
# Usage: python3 validate_transcript.py <transcript_pdf>

import sys
import fitz  # PyMuPDF
from course_validator import validate_courses, print_validation_report, extract_course_codes
from course_reference import COURSE_REFERENCE, is_valid_course, get_course_category, get_course_title


def extract_text_from_pdf(pdf_path: str) -> str:
    """
    Extract plain text from all pages of a PDF file.
    
    Args:
        pdf_path (str): Path to the PDF file
        
    Returns:
        str: Extracted text from all pages
    """
    try:
        # Open the PDF file
        pdf_document = fitz.open(pdf_path)
        all_text = ""
        
        # Iterate through each page
        for page_num in range(len(pdf_document)):
            page = pdf_document[page_num]
            page_text = page.get_text()
            all_text += page_text
        
        pdf_document.close()
        return all_text
        
    except FileNotFoundError:
        print(f"Error: File '{pdf_path}' not found.")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


def main():
    """Main function to extract and validate transcript."""
    
    if len(sys.argv) < 2:
        print("Usage: python3 validate_transcript.py <transcript_pdf>")
        print("Example: python3 validate_transcript.py transcript.pdf")
        sys.exit(1)
    
    transcript_pdf = sys.argv[1]
    
    print("\n" + "="*80)
    print("COMPUTER SCIENCE DEGREE - TRANSCRIPT EXTRACTION AND VALIDATION")
    print("="*80)
    print(f"\nExtracting text from: {transcript_pdf}\n")
    
    # Extract text from PDF
    transcript_text = extract_text_from_pdf(transcript_pdf)
    
    print(f"✓ Successfully extracted {len(transcript_text)} characters\n")
    
    # Extract course codes from transcript
    print("Scanning transcript for course codes...")
    found_courses = extract_course_codes(transcript_text)
    
    print(f"✓ Found {len(found_courses)} course(s) in transcript\n")
    
    # Validate courses using CS degree reference
    print("="*80)
    print("COURSE VALIDATION AGAINST CS DEGREE REQUIREMENTS")
    print("="*80)
    
    valid_courses = {
        'core': [],
        'electives': [],
        'math': [],
        'cloud': [],
        'gen_ed': [],
        'unknown': []
    }
    
    print("\nValidating each course:\n")
    
    for course_code in found_courses:
        is_valid = is_valid_course(course_code)
        category = get_course_category(course_code)
        title = get_course_title(course_code)
        
        status = "✓ VALID" if is_valid else "✗ INVALID"
        print(f"  {course_code:12} → {status:12} | {title}")
        
        # Categorize
        if category == "core_cs_courses":
            valid_courses['core'].append(course_code)
        elif category == "cs_electives":
            valid_courses['electives'].append(course_code)
        elif category == "math_requirements":
            valid_courses['math'].append(course_code)
        elif category == "cloud_courses":
            valid_courses['cloud'].append(course_code)
        elif "gen_ed" in category:
            valid_courses['gen_ed'].append(course_code)
        else:
            valid_courses['unknown'].append(course_code)
    
    # Print summary
    print("\n" + "="*80)
    print("VALIDATION SUMMARY")
    print("="*80)
    
    total_valid = sum(len(v) for k, v in valid_courses.items() if k != 'unknown')
    total_unknown = len(valid_courses['unknown'])
    total_found = len(found_courses)
    
    print(f"\n📊 COURSES FOUND IN TRANSCRIPT: {total_found}")
    print(f"   ✓ Valid (in curriculum): {total_valid}")
    print(f"   ✗ Unknown/Invalid: {total_unknown}")
    
    if total_found > 0:
        percentage = (total_valid / total_found) * 100
        print(f"   📈 Validation Rate: {percentage:.1f}%\n")
    
    # Breakdown by category
    print("BREAKDOWN BY CATEGORY:")
    print(f"  • Core CS Courses: {len(valid_courses['core'])}")
    print(f"  • CS Electives: {len(valid_courses['electives'])}")
    print(f"  • Math Requirements: {len(valid_courses['math'])}")
    print(f"  • Cloud Courses: {len(valid_courses['cloud'])}")
    print(f"  • General Education: {len(valid_courses['gen_ed'])}")
    
    # Show degree requirements status
    print("\n" + "="*80)
    print("DEGREE REQUIREMENTS STATUS")
    print("="*80)
    
    core_requirements = COURSE_REFERENCE["core_cs_courses"].keys()
    completed_core = [c for c in valid_courses['core'] if c in core_requirements]
    missing_core = [c for c in core_requirements if c not in completed_core]
    
    print(f"\n📚 CORE CS REQUIREMENTS:")
    print(f"   Completed: {len(completed_core)}/{len(core_requirements)}")
    
    if completed_core:
        print(f"   ✓ Completed Courses:")
        for course in sorted(completed_core):
            title = COURSE_REFERENCE["core_cs_courses"].get(course, "Unknown")
            print(f"      • {course}: {title}")
    
    if missing_core:
        print(f"\n   ✗ Missing Core Requirements ({len(missing_core)}):")
        for course in sorted(missing_core):
            title = COURSE_REFERENCE["core_cs_courses"].get(course, "Unknown")
            print(f"      • {course}: {title}")
    
    # Math requirements
    math_requirements = COURSE_REFERENCE["math_requirements"].keys()
    completed_math = [c for c in valid_courses['math'] if c in math_requirements]
    missing_math = [c for c in math_requirements if c not in completed_math]
    
    print(f"\n📐 MATH REQUIREMENTS:")
    print(f"   Completed: {len(completed_math)}/{len(math_requirements)}")
    
    if missing_math:
        print(f"   ✗ Missing Math Courses ({len(missing_math)}):")
        for course in sorted(missing_math):
            title = COURSE_REFERENCE["math_requirements"].get(course, "Unknown")
            print(f"      • {course}: {title}")
    
    # Invalid/Unknown courses
    if valid_courses['unknown']:
        print(f"\n⚠️  UNKNOWN/INVALID COURSES ({len(valid_courses['unknown'])}):")
        for course in sorted(valid_courses['unknown']):
            print(f"   • {course}")
    
    # Print text preview
    print("\n" + "="*80)
    print("EXTRACTED TEXT PREVIEW (First 400 characters)")
    print("="*80)
    preview = transcript_text[:400].replace('\n', ' ')
    print(f"\n{preview}...\n")
    
    # Final status
    print("="*80)
    if not valid_courses['unknown'] and not missing_core and not missing_math:
        print("✓ ALL REQUIREMENTS MET! Transcript is complete for CS degree.")
    elif not valid_courses['unknown']:
        total_missing = len(missing_core) + len(missing_math)
        print(f"⚠️  INCOMPLETE: {total_missing} requirement(s) still needed.")
    else:
        print("⚠️  WARNING: Some courses in transcript not recognized in curriculum.")
    print("="*80 + "\n")


if __name__ == "__main__":
    main()
