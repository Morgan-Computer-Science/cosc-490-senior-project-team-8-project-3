import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdvising } from '../context/AdvisingContext';
import AIChat from '../components/ai/AIChat';
import { runAudit, runScheduleAgent } from '../api/advising';
import '../styles/results.css';

export default function Results() {
  const { state } = useAdvising();
  const navigate = useNavigate();
  const [auditResult, setAuditResult] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [schedulePlan, setSchedulePlan] = useState(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState('');

  const handleRunAudit = async () => {
    if (!uploadResult) return;
    setAuditLoading(true);
    setAuditError('');
    try {
      const res = await runAudit({
        sessionId: state.confirmationId,
        student: uploadResult.student,
        validation: uploadResult.validation,
      });
      setAuditResult(res.audit);
    } catch (err) {
      setAuditError(err.message || 'Audit failed');
    } finally {
      setAuditLoading(false);
    }
  };

  const handleRunScheduleAgent = async () => {
    if (!uploadResult) return;
    setScheduleLoading(true);
    setScheduleError('');
    try {
      const res = await runScheduleAgent({
        sessionId: state.confirmationId,
        student: uploadResult.student,
        validation: uploadResult.validation,
        goals: uploadResult.goals,
        requestedCourses: uploadResult.requestedCourses,
      });
      setSchedulePlan(res.plan);
    } catch (err) {
      setScheduleError(err.message || 'Schedule planning failed');
    } finally {
      setScheduleLoading(false);
    }
  };

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
            <h2>Upload Information</h2>
            <p><strong>File:</strong> {uploadResult.fileName || 'Unknown'}</p>
            <p><strong>Transcript ID:</strong> {uploadResult.transcript_id || 'N/A'}</p>
            {uploadResult.inputMode === 'manual' && (
              <p style={{ color: 'var(--accent)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                Submitted via manual course entry
              </p>
            )}
          </div>

          {/* ── Degree Audit Agent ── */}
          <div className="section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2 style={{ margin: 0 }}>Degree Audit Agent</h2>
                <p style={{ fontSize: '0.83rem', color: 'var(--muted)', margin: '0.25rem 0 0' }}>
                  Run a systematic, requirement-by-requirement audit powered by AI tool use.
                </p>
              </div>
              {!auditResult && (
                <button
                  className="btn btn-primary"
                  onClick={handleRunAudit}
                  disabled={auditLoading}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {auditLoading ? 'Auditing...' : 'Run Full Audit'}
                </button>
              )}
            </div>

            {auditError && (
              <div className="conflict-pill" style={{ marginTop: '1rem' }}>{auditError}</div>
            )}

            {auditResult && (
              <div style={{ marginTop: '1.25rem' }}>
                {/* Overall status */}
                {auditResult.overall && (
                  <div className="review-card" style={{ marginBottom: '1rem' }}>
                    <div className="review-label" style={{
                      color: auditResult.overall.overall_status === 'ON_TRACK' ? 'var(--accent)'
                        : auditResult.overall.overall_status === 'AT_RISK' ? '#facc15' : '#f87171',
                    }}>
                      {auditResult.overall.overall_status?.replace(/_/g, ' ')}
                    </div>
                    <p style={{ fontSize: '0.9rem', lineHeight: '1.7', color: 'var(--muted)', marginTop: '0.25rem' }}>
                      {auditResult.overall.summary}
                    </p>
                    {auditResult.overall.estimated_semesters > 0 && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text)', marginTop: '0.25rem' }}>
                        Estimated semesters remaining: <strong>{auditResult.overall.estimated_semesters}</strong>
                      </p>
                    )}
                  </div>
                )}

                {/* Requirements */}
                {auditResult.requirements?.length > 0 && (
                  <div className="requirements-container">
                    {auditResult.requirements.map((req, i) => (
                      <div key={i} className="requirement-subsection">
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem',
                            borderRadius: '4px', letterSpacing: '0.05em',
                            background: req.status === 'SATISFIED' ? 'rgba(110,231,183,0.15)'
                              : req.status === 'PARTIAL' ? 'rgba(250,204,21,0.15)' : 'rgba(248,113,113,0.15)',
                            color: req.status === 'SATISFIED' ? 'var(--accent)'
                              : req.status === 'PARTIAL' ? '#facc15' : '#f87171',
                          }}>
                            {req.status}
                          </span>
                          {req.category}
                        </h3>
                        {req.completed?.length > 0 && (
                          <div style={{ marginTop: '0.4rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Completed: </span>
                            <span style={{ fontSize: '0.8rem' }}>{req.completed.join(', ')}</span>
                          </div>
                        )}
                        {req.missing?.length > 0 && (
                          <div style={{ marginTop: '0.2rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Missing: </span>
                            <span style={{ fontSize: '0.8rem', color: '#f87171' }}>{req.missing.join(', ')}</span>
                          </div>
                        )}
                        {req.notes && (
                          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.4rem', lineHeight: 1.6 }}>
                            {req.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Risks */}
                {auditResult.risks?.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <h3>Graduation Risks</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                      {auditResult.risks.map((risk, i) => (
                        <div key={i} style={{
                          padding: '0.75rem 1rem', borderRadius: '8px', lineHeight: 1.6,
                          background: risk.severity === 'HIGH' ? 'rgba(248,113,113,0.1)'
                            : risk.severity === 'MEDIUM' ? 'rgba(250,204,21,0.1)' : 'rgba(110,231,183,0.05)',
                          borderLeft: `3px solid ${risk.severity === 'HIGH' ? '#f87171' : risk.severity === 'MEDIUM' ? '#facc15' : 'var(--accent)'}`,
                        }}>
                          <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.25rem',
                            color: risk.severity === 'HIGH' ? '#f87171' : risk.severity === 'MEDIUM' ? '#facc15' : 'var(--accent)',
                          }}>
                            {risk.severity} RISK
                          </div>
                          <div style={{ fontSize: '0.85rem' }}>{risk.description}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                            Action: {risk.action}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Schedule Planning Agent ── */}
          <div className="section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2 style={{ margin: 0 }}>Multi-Semester Schedule Plan</h2>
                <p style={{ fontSize: '0.83rem', color: 'var(--muted)', margin: '0.25rem 0 0' }}>
                  AI agent that plans your courses across multiple semesters with sequencing constraints.
                </p>
              </div>
              {!schedulePlan && (
                <button
                  className="btn btn-primary"
                  onClick={handleRunScheduleAgent}
                  disabled={scheduleLoading}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {scheduleLoading ? 'Planning...' : 'Plan My Schedule'}
                </button>
              )}
            </div>

            {scheduleError && (
              <div className="conflict-pill" style={{ marginTop: '1rem' }}>{scheduleError}</div>
            )}

            {schedulePlan && (
              <div style={{ marginTop: '1.25rem' }}>
                {schedulePlan.summary && (
                  <div className="review-card" style={{ marginBottom: '1rem' }}>
                    <div className="review-label">Plan Summary</div>
                    <p style={{ fontSize: '0.9rem', lineHeight: '1.7', color: 'var(--muted)', marginTop: '0.25rem' }}>
                      {schedulePlan.summary.summary}
                    </p>
                    {schedulePlan.summary.semesters_to_graduation > 0 && (
                      <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                        Estimated semesters to graduation: <strong>{schedulePlan.summary.semesters_to_graduation}</strong>
                      </p>
                    )}
                    {schedulePlan.summary.credit_load_warning && (
                      <p style={{ fontSize: '0.8rem', color: '#facc15', marginTop: '0.25rem' }}>
                        {schedulePlan.summary.credit_load_warning}
                      </p>
                    )}
                  </div>
                )}

                {/* Group courses by semester */}
                {schedulePlan.courses?.length > 0 && (() => {
                  const bySemester = schedulePlan.courses.reduce((acc, c) => {
                    const sem = c.semester || 'Unscheduled';
                    if (!acc[sem]) acc[sem] = [];
                    acc[sem].push(c);
                    return acc;
                  }, {});
                  return Object.entries(bySemester).map(([sem, courses]) => (
                    <div key={sem} style={{ marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '0.9rem', color: 'var(--accent)', marginBottom: '0.5rem' }}>
                        {sem}
                      </h3>
                      <div className="requirements-container">
                        {courses.map((c, i) => (
                          <div key={i} className="requirement-subsection">
                            <h3>{c.code} — {c.name}</h3>
                            <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '0.3rem', lineHeight: 1.6 }}>
                              {c.reason}
                              {c.credit_hours && ` · ${c.credit_hours} credits`}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}

                {schedulePlan.notes?.length > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <h3 style={{ fontSize: '0.85rem' }}>Scheduling Notes</h3>
                    <ul style={{ marginTop: '0.5rem', paddingLeft: '1.2rem', lineHeight: 1.8 }}>
                      {schedulePlan.notes.map((n, i) => (
                        <li key={i} style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                          <strong>{n.type}: </strong>{n.note}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
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
          className="btn btn-ghost"
          onClick={() => {
            const text = `BearAdvisor results for ${uploadResult?.student?.name || 'student'} — Session ${state.confirmationId || ''}`;
            if (navigator.clipboard) navigator.clipboard.writeText(text);
            alert('Session ID copied — share with your advisor: ' + (state.confirmationId || 'N/A'));
          }}
        >
          Share with Advisor
        </button>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/home')}
        >
          Home
        </button>
      </div>

      <AIChat />
    </div>
  );
}
