# Computer Science Degree Course Reference
# Reference guide for all CS degree requirements and electives

COURSE_REFERENCE = {
    "core_cs_courses": {
        "COSC111": "Introduction to Computer Science I",
        "COSC112": "Introduction to Computer Science II",
        "COSC220": "Data Structures and Algorithms",
        "COSC238": "Object-Oriented Programming",
        "COSC241": "Computer Systems and Digital Logic",
        "COSC243": "Computer Architecture",
        "COSC281": "Discrete Structures",
        "COSC349": "Computer Networks",
        "COSC354": "Operating Systems",
        "COSC458": "Software Engineering",
        "COSC459": "Database Design",
        "COSC490": "Senior Project",
    },
    
    "cs_electives": {
        "COSC332": "Introduction to Game Design and Development",
        "COSC338": "Mobile Application Design and Development",
        "COSC351": "Cybersecurity",
        "COSC352": "Organization of Programming Languages",
        "COSC385": "Theory of Languages and Automata",
        "COSC460": "Computer Graphics",
        "COSC472": "Introduction to Machine Learning",
        "COSC498": "Internship in Computer Science",
        "COSC499": "Research in Computer Science",
    },
    
    "math_requirements": {
        "MATH241": "Calculus I",
        "MATH242": "Calculus II",
        "MATH312": "Linear Algebra",
        "MATH331": "Probability and Statistics",
    },
    
    "cloud_courses": {
        "CLCO261": "Introduction to Cloud Computing",
        "CLCO471": "Data Analytics in the Cloud",
    },
    
    "gen_ed_courses": {
        "writing_communication": {
            "ENGL101": "Freshman Composition",
            "ENGL102": "Advanced Composition",
        },
        "humanities": {
            "PHIL": "Philosophy",
            "HIST": "History",
            "ART": "Art Appreciation",
        },
        "social_sciences": {
            "ECON": "Economics",
            "PSYC": "Psychology",
            "SOCI": "Sociology",
        },
        "natural_sciences": {
            "PHYS": "Physics",
            "CHEM": "Chemistry",
            "BIOL": "Biology",
        },
    },
}


# Flattened list for quick lookup
ALL_COURSE_CODES = []
ALL_GEN_ED_PREFIXES = []


def initialize_course_lists():
    """Initialize flattened lists for quick lookups."""
    global ALL_COURSE_CODES, ALL_GEN_ED_PREFIXES
    
    # Add specific course codes
    ALL_COURSE_CODES.extend(COURSE_REFERENCE["core_cs_courses"].keys())
    ALL_COURSE_CODES.extend(COURSE_REFERENCE["cs_electives"].keys())
    ALL_COURSE_CODES.extend(COURSE_REFERENCE["math_requirements"].keys())
    ALL_COURSE_CODES.extend(COURSE_REFERENCE["cloud_courses"].keys())
    
    # Add specific gen ed course codes
    for category in COURSE_REFERENCE["gen_ed_courses"].values():
        if isinstance(category, dict):
            ALL_COURSE_CODES.extend(category.keys())
    
    # Add gen ed prefixes
    ALL_GEN_ED_PREFIXES = [
        "ENGL", "PHIL", "HIST", "ART", 
        "ECON", "PSYC", "SOCI", 
        "PHYS", "CHEM", "BIOL"
    ]


def get_course_category(course_code: str) -> str:
    """
    Determine which category a course belongs to.
    
    Args:
        course_code (str): Course code to categorize
        
    Returns:
        str: Category name or 'unknown' if not found
    """
    course_code = course_code.upper()
    
    # Check core courses
    if course_code in COURSE_REFERENCE["core_cs_courses"]:
        return "core_cs_courses"
    
    # Check electives
    if course_code in COURSE_REFERENCE["cs_electives"]:
        return "cs_electives"
    
    # Check math requirements
    if course_code in COURSE_REFERENCE["math_requirements"]:
        return "math_requirements"
    
    # Check cloud courses
    if course_code in COURSE_REFERENCE["cloud_courses"]:
        return "cloud_courses"
    
    # Check gen ed courses
    for category_name, courses in COURSE_REFERENCE["gen_ed_courses"].items():
        if isinstance(courses, dict):
            if course_code in courses:
                return f"gen_ed_courses.{category_name}"
    
    # Check gen ed prefixes
    for prefix in ALL_GEN_ED_PREFIXES:
        if course_code.startswith(prefix):
            return "gen_ed_courses"
    
    return "unknown"


def is_valid_course(course_code: str) -> bool:
    """
    Check if a course code is in the reference.
    
    Args:
        course_code (str): Course code to validate
        
    Returns:
        bool: True if course is in reference
    """
    course_code = course_code.upper()
    
    # Check specific courses
    if course_code in ALL_COURSE_CODES:
        return True
    
    # Check gen ed prefixes
    for prefix in ALL_GEN_ED_PREFIXES:
        if course_code.startswith(prefix):
            return True
    
    return False


def get_course_title(course_code: str) -> str:
    """
    Get the full title of a course.
    
    Args:
        course_code (str): Course code
        
    Returns:
        str: Course title or 'Unknown Course' if not found
    """
    course_code = course_code.upper()
    
    # Check all categories
    for category, courses in COURSE_REFERENCE.items():
        if isinstance(courses, dict):
            for subcat, subcourses in courses.items():
                if isinstance(subcourses, dict):
                    if course_code in subcourses:
                        return subcourses[course_code]
                elif course_code == subcat:
                    return courses[subcat]
    
    return "Unknown Course"


def get_all_core_requirements() -> list:
    """Get all core CS requirements that must be completed."""
    return list(COURSE_REFERENCE["core_cs_courses"].keys())


def get_all_requirements() -> list:
    """Get all course codes in the reference."""
    all_courses = []
    all_courses.extend(COURSE_REFERENCE["core_cs_courses"].keys())
    all_courses.extend(COURSE_REFERENCE["cs_electives"].keys())
    all_courses.extend(COURSE_REFERENCE["math_requirements"].keys())
    all_courses.extend(COURSE_REFERENCE["cloud_courses"].keys())
    return sorted(list(set(all_courses)))


# Initialize on module load
initialize_course_lists()


if __name__ == "__main__":
    # Example usage
    print("="*60)
    print("COMPUTER SCIENCE DEGREE COURSE REFERENCE")
    print("="*60)
    
    print("\nCore CS Courses:")
    for code, title in COURSE_REFERENCE["core_cs_courses"].items():
        print(f"  {code}: {title}")
    
    print("\nCS Electives (Sample):")
    for i, (code, title) in enumerate(COURSE_REFERENCE["cs_electives"].items()):
        if i < 3:
            print(f"  {code}: {title}")
    print(f"  ... and {len(COURSE_REFERENCE['cs_electives']) - 3} more")
    
    print("\nVALIDATION EXAMPLES:")
    test_codes = ["COSC111", "MATH241", "UNKNOWN999", "ENGL101", "BIOL"]
    for code in test_codes:
        is_valid = is_valid_course(code)
        category = get_course_category(code)
        print(f"  {code:12} → Valid: {is_valid:5} | Category: {category}")
    
    print("\n" + "="*60)
