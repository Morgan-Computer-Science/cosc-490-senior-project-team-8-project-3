# Extract plain text from a PDF file using PyMuPDF

import sys
import fitz  # PyMuPDF
from tkinter import Tk, filedialog

def extract_text_from_pdf(pdf_path):
    """
    Extract plain text from all pages of a PDF file.
    
    Args:
        pdf_path (str): Path to the PDF file
    """
    try:
        # Open the PDF file
        pdf_document = fitz.open(pdf_path)
        
        # Initialize empty string to store all text
        all_text = ""
        
        # Iterate through each page in the PDF
        for page_num in range(len(pdf_document)):
            # Get the current page
            page = pdf_document[page_num]
            
            # Extract text from the page
            page_text = page.get_text()
            
            # Add page text to the accumulated text
            all_text += page_text
        
        # Close the PDF document
        pdf_document.close()
        
        # Print the extracted text
        print("\n" + "="*50)
        print("EXTRACTED TEXT FROM PDF")
        print("="*50 + "\n")
        print(all_text)
        
    except FileNotFoundError:
        print(f"Error: File '{pdf_path}' not found.")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


def upload_pdf_dialog():
    """
    Open a file dialog to select a PDF file.
    
    Returns:
        str: Path to the selected PDF file, or None if cancelled
    """
    # Create a hidden Tkinter root window
    root = Tk()
    root.withdraw()
    
    # Open file dialog to select PDF
    file_path = filedialog.askopenfilename(
        title="Select a PDF file",
        filetypes=[("PDF files", "*.pdf"), ("All files", "*.*")]
    )
    
    # Destroy the root window
    root.destroy()
    
    return file_path


if __name__ == "__main__":
    # Check if a file path was provided as command line argument
    if len(sys.argv) > 1:
        # Use the provided file path
        pdf_file_path = sys.argv[1]
    else:
        # Open file upload dialog
        print("Opening file dialog to select a PDF...")
        pdf_file_path = upload_pdf_dialog()
        
        # Check if user cancelled the dialog
        if not pdf_file_path:
            print("No file selected. Exiting.")
            sys.exit(0)
    
    # Extract and print text
    extract_text_from_pdf(pdf_file_path)
