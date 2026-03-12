import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdvising } from '../context/AdvisingContext';
import '../styles/results.css';

export default function Results() {
  const { state } = useAdvising();
  const navigate = useNavigate();

  useEffect(() => {
    if (!state.uploadResult) {
      // if someone visits directly, send back to advising form
      navigate('/advising');
    }
  }, [navigate, state.uploadResult]);

  if (!state.uploadResult) {
    return null;
  }

  const uploadResult = state.uploadResult;
  const validation = uploadResult.validation || {};
  const termMarkers = uploadResult.termMarkers || [];
  const parsedDegreeWorksRows = uploadResult.parsedDegreeWorksRows || [];
  const classifiedCourses = uploadResult.classifiedCourses || [];
  const availableOptions = uploadResult.availableOptions || [];
  const aiSummary = uploadResult.aiSummary || null;
  const recommendedSchedule = uploadResult.recommendedSchedule || [];
  const completedSupportingRequirements = validation.completedSupportingRequirements || [];
  const completedGenEdRequirements = validation.completedGenEdRequirements || [];
  const completedGenEdElectives = validation.completedGenEdElectives || [];
  const completedFreeElectives = validation.completedFreeElectives || [];

  // Check if this is from Python transcript validation
  const isPythonValidation = !!validation.totalFound;

  return (
    <div className="results-page">
      <div className="results-header">
        <h1>Transcript Analysis Results</h1>
        <p className="results-subtitle">Your transcript has been analyzed against your degree requirements</p>
      </div>

      {isPythonValidation && (
        <>
          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="card summary-card">
              <div className="card-value">{validation.totalFound || 0}</div>
              <div className="card-label">Courses Found</div>
            </div>
            <div className="card summary-card">
              <div className="card-value" style={{ color: '#4CAF50' }}>{validation.validCount || 0}</div>
              <div className="card-label">Valid (In Curriculum)</div>
            </div>
            <div className="card summary-card">
              <div className="card-value" style={{ color: '#f44336' }}>{validation.invalidCount || 0}</div>
              <div className="card-label">Unclassified Courses</div>
            </div>
            <div className="card summary-card">
              <div className="card-value">{validation.validationRate?.toFixed(1) || 0}%</div>
              <div className="card-label">Validation Rate</div>
            </div>
          </div>

          {/* Status Banner */}
          <div className={`status-banner status-${validation.status?.toLowerCase() || 'incomplete'}`}>
            {validation.status === 'COMPLETE' && (
              <>
                <span className="status-icon">✓</span>
                <div className="status-text">
                  <strong>All Requirements Met!</strong>
                  <p>Your transcript is complete for the Computer Science degree.</p>
                </div>
              </>
            )}
            {validation.status === 'INCOMPLETE' && (
              <>
                <span className="status-icon">⚠️</span>
                <div className="status-text">
                  <strong>Incomplete Degree</strong>
                  <p>{validation.missingCoreRequirements?.length || 0} core requirement(s) and {validation.missingMathRequirements?.length || 0} math requirement(s) still needed.</p>
                </div>
              </>
            )}
            {validation.status === 'INVALID_COURSES_FOUND' && (
              <>
                <span className="status-icon">❌</span>
                <div className="status-text">
                  <strong>Courses Need More Mapping</strong>
                  <p>{validation.invalidCount || 0} course(s) could not yet be mapped into the curriculum or Degree Works blocks. Review below.</p>
                </div>
              </>
            )}
          </div>

          {aiSummary && (
            <div className="section">
              <h2>AI Summary</h2>
              <div className="review-card" style={{ marginTop: '1rem' }}>
                <div className="review-label">
                  {aiSummary.headline || 'Transcript Summary'}
                  {aiSummary.source && (
                    <span style={{ color: 'var(--muted)', fontWeight: 500 }}>
                      {aiSummary.source === 'vertex' ? 'Vertex' : 'Fallback'}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.95rem', lineHeight: '1.7', color: 'var(--muted)' }}>
                  {aiSummary.summary}
                </p>
                {Array.isArray(aiSummary.recommendations) && aiSummary.recommendations.length > 0 && (
                  <>
                    <h3 style={{ marginTop: '1rem' }}>Recommended next steps</h3>
                    <ul style={{ marginTop: '0.5rem', paddingLeft: '1.2rem', lineHeight: '1.8' }}>
                      {aiSummary.recommendations.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </>
                )}
                {Array.isArray(aiSummary.risks) && aiSummary.risks.length > 0 && (
                  <>
                    <h3 style={{ marginTop: '1rem' }}>Watchouts</h3>
                    <ul style={{ marginTop: '0.5rem', paddingLeft: '1.2rem', lineHeight: '1.8' }}>
                      {aiSummary.risks.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          )}

          {Array.isArray(recommendedSchedule) && recommendedSchedule.length > 0 && (
            <div className="section">
              <h2>Recommended Course Schedule</h2>
              <div className="requirements-container" style={{ marginTop: '1rem' }}>
                {recommendedSchedule.map((course) => (
                  <div key={`${course.priority}-${course.code}`} className="requirement-subsection">
                    <h3>
                      {course.priority}. {course.code} {course.name ? `- ${course.name}` : ''}
                    </h3>
                    <p style={{ marginTop: '0.5rem', color: 'var(--muted)', lineHeight: '1.7' }}>
                      <strong>{course.recommendationType || 'Required'}:</strong> {course.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(classifiedCourses) && classifiedCourses.length > 0 && (
            <div className="section">
              <h2>Curriculum Matching</h2>
              <div className="requirements-container" style={{ marginTop: '1rem' }}>
                {classifiedCourses.map((course) => (
                  <div key={course.normalizedCourseCode} className="requirement-subsection">
                    <h3>{course.normalizedCourseCode}</h3>
                    <p style={{ marginTop: '0.5rem', color: 'var(--muted)', lineHeight: '1.7' }}>
                      <strong>Category:</strong> {course.category || 'UNKNOWN'}
                      {' · '}
                      <strong>Matched requirement:</strong> {course.matchedRequirement || 'None'}
                      {' · '}
                      <strong>Group:</strong> {course.requirementGroup || 'N/A'}
                      {' · '}
                      <strong>Status:</strong> {course.status}
                      {' · '}
                      <strong>Source:</strong> {course.sourceOfMatch}
                      {' · '}
                      <strong>Source type:</strong> {course.sourceType || 'N/A'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(availableOptions) && availableOptions.length > 0 && (
            <div className="section">
              <h2>Eligible Options From Unmet Requirements</h2>
              <div className="requirements-container" style={{ marginTop: '1rem' }}>
                {availableOptions.map((option) => (
                  <div key={option.normalizedCourseCode} className="requirement-subsection">
                    <h3>{option.normalizedCourseCode}</h3>
                    <p style={{ marginTop: '0.5rem', color: 'var(--muted)', lineHeight: '1.7' }}>
                      <strong>Label:</strong> Eligible Option
                      {' · '}
                      <strong>Requirement:</strong> {option.matchedRequirement}
                      {' · '}
                      <strong>Group:</strong> {option.requirementGroup || 'N/A'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(parsedDegreeWorksRows) && parsedDegreeWorksRows.length > 0 && (
            <div className="section">
              <h2>Parsed Degree Works Rows</h2>
              <div className="requirements-container" style={{ marginTop: '1rem' }}>
                {parsedDegreeWorksRows.map((row) => (
                  <div key={`${row.courseCode}-${row.term || 'no-term'}`} className="requirement-subsection">
                    <h3>{row.courseCode}{row.courseTitle ? ` - ${row.courseTitle}` : ''}</h3>
                    <p style={{ marginTop: '0.5rem', color: 'var(--muted)', lineHeight: '1.7' }}>
                      <strong>Status:</strong> {row.status}
                      {' · '}
                      <strong>Grade:</strong> {row.grade || 'N/A'}
                      {' · '}
                      <strong>Credits:</strong> {row.credits ?? 'N/A'}
                      {' · '}
                      <strong>Term:</strong> {row.term || 'N/A'}
                      {' · '}
                      <strong>Section:</strong> {row.section || 'N/A'}
                      {' · '}
                      <strong>Confidence:</strong> {row.confidence}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Breakdown by Category */}
          <div className="section">
            <h2>📊 Courses by Category</h2>
            <div className="category-grid">
              <div className="category-card">
                <div className="category-name">Core CS</div>
                <div className="category-count">{validation.coursesByCategory?.core?.length || 0}</div>
              </div>
              <div className="category-card">
                <div className="category-name">Electives</div>
                <div className="category-count">{validation.coursesByCategory?.electives?.length || 0}</div>
              </div>
              <div className="category-card">
                <div className="category-name">Supporting</div>
                <div className="category-count">{completedSupportingRequirements.length || 0}</div>
              </div>
              <div className="category-card">
                <div className="category-name">Math</div>
                <div className="category-count">{validation.coursesByCategory?.math?.length || 0}</div>
              </div>
              <div className="category-card">
                <div className="category-name">Gen Ed</div>
                <div className="category-count">{validation.coursesByCategory?.genEd?.length || 0}</div>
              </div>
            </div>
          </div>

          {/* Core Requirements Status */}
          <div className="section">
            <h2>📚 Core CS Requirements</h2>
            <div className="requirements-container">
              {validation.completedCoreRequirements && validation.completedCoreRequirements.length > 0 && (
                <div className="requirement-subsection">
                  <h3>✓ Completed ({validation.completedCoreRequirements.length})</h3>
                  <div className="course-grid">
                    {validation.completedCoreRequirements.map((course) => (
                      <div key={course} className="course-badge completed">
                        {course}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {validation.missingCoreRequirements && validation.missingCoreRequirements.length > 0 && (
                <div className="requirement-subsection">
                  <h3>✗ Missing ({validation.missingCoreRequirements.length})</h3>
                  <div className="course-grid">
                    {validation.missingCoreRequirements.map((course) => (
                      <div key={course} className="course-badge missing">
                        {course}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Math Requirements Status */}
          <div className="section">
            <h2>📐 Math Requirements</h2>
            <div className="requirements-container">
              {validation.completedMathRequirements && validation.completedMathRequirements.length > 0 && (
                <div className="requirement-subsection">
                  <h3>✓ Completed ({validation.completedMathRequirements.length})</h3>
                  <div className="course-grid">
                    {validation.completedMathRequirements.map((course) => (
                      <div key={course} className="course-badge completed">
                        {course}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {validation.missingMathRequirements && validation.missingMathRequirements.length > 0 && (
                <div className="requirement-subsection">
                  <h3>✗ Missing ({validation.missingMathRequirements.length})</h3>
                  <div className="course-grid">
                    {validation.missingMathRequirements.map((course) => (
                      <div key={course} className="course-badge missing">
                        {course}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {completedSupportingRequirements.length > 0 && (
            <div className="section">
              <h2>🧩 Supporting Requirements</h2>
              <div className="course-grid">
                {completedSupportingRequirements.map((course) => (
                  <div key={course} className="course-badge completed">
                    {course}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(completedGenEdRequirements.length > 0 || completedGenEdElectives.length > 0) && (
            <div className="section">
              <h2>📝 General Education</h2>
              <div className="requirements-container">
                {completedGenEdRequirements.length > 0 && (
                  <div className="requirement-subsection">
                    <h3>Required Gen Ed</h3>
                    <div className="course-grid">
                      {completedGenEdRequirements.map((course) => (
                        <div key={course} className="course-badge completed">
                          {course}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {completedGenEdElectives.length > 0 && (
                  <div className="requirement-subsection">
                    <h3>Gen Ed Electives</h3>
                    <div className="course-grid">
                      {completedGenEdElectives.map((course) => (
                        <div key={course} className="course-badge completed">
                          {course}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {completedFreeElectives.length > 0 && (
            <div className="section">
              <h2>📚 Free Electives</h2>
              <div className="course-grid">
                {completedFreeElectives.map((course) => (
                  <div key={course} className="course-badge completed">
                    {course}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unclassified Courses */}
          {validation.unknownCourses && validation.unknownCourses.length > 0 && (
            <div className="section warning-section">
              <h2>⚠️ Unclassified Courses</h2>
              <p>These courses were found in your transcript but have not yet been mapped by the curriculum seed or Degree Works satisfied blocks:</p>
              <div className="course-grid">
                {validation.unknownCourses.map((course) => (
                  <div key={course} className="course-badge unknown">
                    {course}
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(termMarkers) && termMarkers.length > 0 && (
            <div className="section file-info">
              <h2>Transcript Terms</h2>
              <p>These were detected as term markers in the transcript, not course codes:</p>
              <div className="course-grid">
                {termMarkers.map((term) => (
                  <div key={term} className="course-badge completed">
                    {term}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* File Information */}
          <div className="section file-info">
            <h2>📄 Upload Information</h2>
            <p><strong>File:</strong> {uploadResult.fileName || 'Unknown'}</p>
            <p><strong>Transcript ID:</strong> {uploadResult.transcript_id || 'N/A'}</p>
          </div>
        </>
      )}

      {/* Legacy Results Display */}
      {!isPythonValidation && (
        <>
          {uploadResult.student && (
            <div className="section">
              <h2>Student</h2>
              <pre>{JSON.stringify(uploadResult.student, null, 2)}</pre>
            </div>
          )}
          <div className="section">
            <h2>Completed Courses</h2>
            <pre>{JSON.stringify(uploadResult.completedCourses, null, 2)}</pre>
          </div>
          <div className="section">
            <h2>Missing Required Courses</h2>
            <pre>{JSON.stringify(uploadResult.missingRequiredCourses, null, 2)}</pre>
          </div>
        </>
      )}

      {/* Navigation Buttons */}
      <div className="results-actions">
        <button 
          className="btn btn-secondary" 
          onClick={() => navigate('/advising')}
        >
          ← Back to Form
        </button>
        <button 
          className="btn btn-primary"
          onClick={() => navigate('/home')}
        >
          Home
        </button>
      </div>
    </div>
  );
}
