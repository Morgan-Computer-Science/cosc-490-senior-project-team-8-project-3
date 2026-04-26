#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { openAsBlob } from 'fs';
import readline from 'readline';
import { spawn } from 'child_process';

const cwd = process.cwd();
const outputDir = path.join(cwd, '.agent-output');
const latestSessionPath = path.join(outputDir, 'latest-session.json');
const defaultBaseUrl = process.env.AGENT_BASE_URL || 'http://127.0.0.1:3001';

function printHelp() {
  console.log(`
Vertex Agent Runner

Usage:
  npm run agent -- help
  npm run agent -- analyze --pdf ./path/to/transcript.pdf [options]
  npm run agent -- manual --manual COSC111:COMPLETED[:A][:Fall2024] [--manual ...] [options]
  npm run agent -- audit
  npm run agent -- schedule
  npm run agent -- chat --message "What classes do I still need?"
  npm run agent -- speak --text "You are on track." --output ./agent-response.mp3
  npm run agent -- record --output ./.agent-output/prompt.wav
  npm run agent -- transcribe --audio ./voice-prompt.webm
  npm run agent -- play --audio ./.agent-output/speech.mp3
  npm run agent -- voice
  npm run agent -- repl

Options:
  --base-url URL          Backend URL. Default: ${defaultBaseUrl}
  --pdf PATH              Transcript PDF for analyze
  --name NAME             Student name
  --netid ID              Student netid or student ID
  --major MAJOR           Student major
  --year YEAR             Student year
  --goal TEXT             Goal text
  --note TEXT             Notes text
  --course CODE           Requested course; repeatable
  --manual SPEC           Manual course in CODE:STATUS[:GRADE][:TERM] format; repeatable
  --session PATH          Session JSON file. Defaults to ${latestSessionPath}
  --message TEXT          Chat message
  --text TEXT             Text to convert to speech
  --audio PATH            Audio file to transcribe
  --output PATH           Output path for generated speech/recording
                          Defaults: .agent-output/speech.mp3 or .agent-output/prompt.wav
  --language CODE         BCP-47 language code. Default: en-US
  --voice NAME            Google Cloud Text-to-Speech voice name
  --encoding ENCODING     Speech-to-Text encoding override, e.g. WEBM_OPUS, MP3, LINEAR16
  --sample-rate HZ        Speech-to-Text sample rate override
  --duration SECONDS      Optional fixed recording length
  --no-play               Save generated speech without playing it

Examples:
  npm run agent -- analyze --pdf ./uploads/sample.pdf --name "Caleb Banks" --year Senior --goal "Graduate as fast as possible"
  npm run agent -- manual --name "Caleb Banks" --manual COSC111:COMPLETED:A:Fall2022 --manual MATH241:COMPLETED:B:Spring2023
  npm run agent -- audit
  npm run agent -- schedule
  npm run agent -- chat --message "Summarize what is still missing"
  npm run agent -- speak --text "BearAdvisor is ready."
  npm run agent -- record --output ./.agent-output/prompt.wav
  npm run agent -- transcribe --audio ./.agent-output/prompt.wav
  npm run agent -- voice --duration 5
  npm run agent -- repl
`.trim());
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }

    i += 1;
    if (args[key] === undefined) {
      args[key] = next;
    } else if (Array.isArray(args[key])) {
      args[key].push(next);
    } else {
      args[key] = [args[key], next];
    }
  }
  return args;
}

function toArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function readSession(sessionPath = latestSessionPath) {
  if (!fs.existsSync(sessionPath)) {
    throw new Error(`No saved session found at ${sessionPath}. Run analyze or manual first.`);
  }
  return JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
}

function writeSession(data, sessionPath = latestSessionPath) {
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(sessionPath, JSON.stringify(data, null, 2));
}

async function postJson(baseUrl, endpoint, body) {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`${endpoint} failed: ${res.status} ${json?.error || text}`);
  }

  return json;
}

async function submitPdf(baseUrl, options) {
  if (!options.pdf) {
    throw new Error('Missing --pdf path');
  }

  const pdfPath = path.resolve(cwd, String(options.pdf));
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF not found: ${pdfPath}`);
  }

  const payload = new FormData();
  payload.append('student', JSON.stringify({
    name: options.name || '',
    netid: options.netid || '',
    major: options.major || 'Computer Science',
    year: options.year || '',
  }));
  payload.append('courses', JSON.stringify(toArray(options.course)));
  payload.append('goals', options.goal || '');
  payload.append('notes', options.note || '');
  payload.append('transcript', await openAsBlob(pdfPath, { type: 'application/pdf' }), path.basename(pdfPath));

  const res = await fetch(`${baseUrl}/api/submit`, {
    method: 'POST',
    body: payload,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`/api/submit failed: ${res.status} ${json?.error || 'Unknown error'}`);
  }

  return json;
}

function parseManualSpec(spec) {
  const [code, status = 'COMPLETED', grade = '', ...termParts] = String(spec).split(':');
  return {
    code: String(code || '').trim().toUpperCase(),
    status: String(status || 'COMPLETED').trim().toUpperCase(),
    grade: String(grade || '').trim().toUpperCase(),
    term: termParts.join(':').trim(),
  };
}

async function submitManual(baseUrl, options) {
  const manualCourses = toArray(options.manual).map(parseManualSpec);
  if (manualCourses.length === 0) {
    throw new Error('Provide at least one --manual CODE:STATUS[:GRADE][:TERM] entry');
  }

  return postJson(baseUrl, '/api/submit-manual', {
    student: {
      name: options.name || '',
      netid: options.netid || '',
      major: options.major || 'Computer Science',
      year: options.year || '',
    },
    manualCourses,
    courses: toArray(options.course),
    goals: options.goal || '',
    notes: options.note || '',
  });
}

function formatTopLevel(result) {
  const validation = result.validation || {};
  const lines = [
    `Student: ${result.student?.name || 'Unknown'}`,
    `Status: ${validation.status || 'UNKNOWN'}`,
    `Found: ${validation.totalFound ?? 0}`,
    `Valid: ${validation.validCount ?? 0}`,
    `Unclassified: ${validation.invalidCount ?? 0}`,
  ];

  if (Array.isArray(validation.missingCoreRequirements) && validation.missingCoreRequirements.length > 0) {
    lines.push(`Missing core: ${validation.missingCoreRequirements.join(', ')}`);
  }
  if (Array.isArray(validation.missingMathRequirements) && validation.missingMathRequirements.length > 0) {
    lines.push(`Missing math: ${validation.missingMathRequirements.join(', ')}`);
  }
  if (Array.isArray(validation.unknownCourses) && validation.unknownCourses.length > 0) {
    lines.push(`Unknown: ${validation.unknownCourses.join(', ')}`);
  }
  if (Array.isArray(result.recommendedSchedule) && result.recommendedSchedule.length > 0) {
    lines.push(`Next courses: ${result.recommendedSchedule.map((course) => course.code).join(', ')}`);
  }

  return lines.join('\n');
}

async function runAudit(baseUrl, options) {
  const session = readSession(options.session);
  const response = await postJson(baseUrl, '/api/audit', {
    sessionId: session.confirmation_id || session.confirmationId || 'terminal-session',
    student: session.student,
    validation: session.validation,
  });
  session.audit = response.audit;
  writeSession(session, options.session || latestSessionPath);
  return response.audit;
}

async function runSchedule(baseUrl, options) {
  const session = readSession(options.session);
  const response = await postJson(baseUrl, '/api/schedule-agent', {
    sessionId: session.confirmation_id || session.confirmationId || 'terminal-session',
    student: session.student,
    validation: session.validation,
    goals: session.goals,
    requestedCourses: session.requestedCourses || [],
  });
  session.plan = response.plan;
  writeSession(session, options.session || latestSessionPath);
  return response.plan;
}

async function runChat(baseUrl, options) {
  if (!options.message) {
    throw new Error('Missing --message text');
  }

  const session = readSession(options.session);
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: session.confirmation_id || session.confirmationId || 'terminal-session',
      message: options.message,
      context: {
        student: session.student,
        validation: session.validation,
        recommendedSchedule: session.recommendedSchedule,
      },
    }),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(`/api/chat failed: ${res.status} ${json?.error || 'Unknown error'}`);
  }

  const raw = await res.text();
  const chunks = raw
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => {
      try {
        return JSON.parse(line.slice(6));
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const text = chunks.map((chunk) => chunk.text || '').join('').trim();
  session.lastChat = {
    prompt: options.message,
    response: text,
    timestamp: new Date().toISOString(),
  };
  writeSession(session, options.session || latestSessionPath);
  return text;
}

function guessAudioMimeType(filePath) {
  const lower = String(filePath || '').toLowerCase();
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.webm')) return 'audio/webm';
  if (lower.endsWith('.ogg') || lower.endsWith('.opus')) return 'audio/ogg';
  if (lower.endsWith('.flac')) return 'audio/flac';
  return 'application/octet-stream';
}

async function runSpeak(baseUrl, options) {
  const text = options.text || options.message;
  if (!text) {
    throw new Error('Missing --text value');
  }

  const response = await postJson(baseUrl, '/api/voice/tts', {
    text,
    languageCode: options.language || 'en-US',
    voiceName: options.voice || '',
    speakingRate: options.rate || 1,
  });

  const outputPath = path.resolve(cwd, String(options.output || path.join(outputDir, 'speech.mp3')));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.from(response.audioContent, 'base64'));
  return outputPath;
}

function runChild(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function runPlay(options) {
  const audioPath = path.resolve(cwd, String(options.audio || options.output || path.join(outputDir, 'speech.mp3')));
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio not found: ${audioPath}`);
  }

  if (process.platform === 'darwin' && commandExists('afplay')) {
    await runChild('afplay', [audioPath]);
    return audioPath;
  }

  throw new Error('No audio playback command found. On macOS, afplay should be available by default.');
}

function commandExists(command) {
  const pathDirs = String(process.env.PATH || '').split(path.delimiter);
  return pathDirs.some((dir) => fs.existsSync(path.join(dir, command)));
}

function getProjectPython() {
  const venvPython = path.join(cwd, '.venv', 'bin', 'python');
  if (fs.existsSync(venvPython)) return venvPython;
  return '';
}

function resolveRecorder(outputPath, options) {
  const duration = Number(options.duration);
  const hasDuration = Number.isFinite(duration) && duration > 0;
  const output = String(outputPath);
  const projectPython = getProjectPython();

  if (projectPython) {
    return {
      command: projectPython,
      args: [
        path.join(cwd, 'scripts', 'record_audio.py'),
        '--output',
        output,
        ...(hasDuration ? ['--duration', String(duration)] : []),
      ],
      stop: (child) => child.kill('SIGINT'),
    };
  }

  if (commandExists('ffmpeg')) {
    return {
      command: 'ffmpeg',
      args: [
        '-hide_banner',
        '-loglevel',
        'error',
        '-f',
        'avfoundation',
        '-i',
        ':0',
        '-ar',
        '16000',
        '-ac',
        '1',
        ...(hasDuration ? ['-t', String(duration)] : []),
        '-y',
        output,
      ],
      stop: (child) => child.stdin.write('q'),
    };
  }

  if (commandExists('rec')) {
    return {
      command: 'rec',
      args: ['-r', '16000', '-c', '1', output, ...(hasDuration ? ['trim', '0', String(duration)] : [])],
      stop: (child) => child.kill('SIGINT'),
    };
  }

  if (commandExists('afrecord')) {
    return {
      command: 'afrecord',
      args: ['-f', 'WAVE', '-d', 'LEI16@16000', ...(hasDuration ? ['-t', String(duration)] : []), output],
      stop: (child) => child.kill('SIGINT'),
    };
  }

  return null;
}

async function runRecord(options) {
  const outputPath = path.resolve(cwd, String(options.output || path.join(outputDir, 'prompt.wav')));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const recorder = resolveRecorder(outputPath, options);
  if (!recorder) {
    throw new Error([
      'No command-line audio recorder found.',
      'Run: npm run setup:venv',
      'Fallback option: install ffmpeg and make sure it is on your PATH.',
      'Then run: npm run agent -- record --output ./.agent-output/prompt.wav',
    ].join('\n'));
  }

  console.log(`Recording to ${outputPath}`);
  if (options.duration) {
    console.log(`Recording for ${options.duration} second(s)...`);
  } else {
    console.log('Press Enter to stop recording.');
  }

  const child = spawn(recorder.command, recorder.args, {
    stdio: ['pipe', 'inherit', 'inherit'],
  });

  const stopOnEnter = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    stopOnEnter.close();
    recorder.stop(child);
  };

  if (!options.duration) {
    stopOnEnter.once('line', stop);
  }

  process.once('SIGINT', stop);

  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => {
      process.removeListener('SIGINT', stop);
      stopOnEnter.close();
      if (code === 0 || stopping) resolve();
      else reject(new Error(`${recorder.command} exited with code ${code}`));
    });
  });

  return outputPath;
}

async function runTranscribe(baseUrl, options) {
  if (!options.audio) {
    throw new Error('Missing --audio path');
  }

  const audioPath = path.resolve(cwd, String(options.audio));
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio not found: ${audioPath}`);
  }

  const payload = new FormData();
  payload.append('audio', await openAsBlob(audioPath, { type: guessAudioMimeType(audioPath) }), path.basename(audioPath));
  payload.append('languageCode', options.language || 'en-US');
  if (options.encoding) payload.append('encoding', options.encoding);
  if (options['sample-rate']) payload.append('sampleRateHertz', options['sample-rate']);

  const res = await fetch(`${baseUrl}/api/voice/stt`, {
    method: 'POST',
    body: payload,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`/api/voice/stt failed: ${res.status} ${json?.error || 'Unknown error'}`);
  }

  return json;
}

async function runVoice(baseUrl, options) {
  const promptPath = path.resolve(cwd, String(options.audio || path.join(outputDir, 'prompt.wav')));
  const speechPath = path.resolve(cwd, String(options.output || path.join(outputDir, 'speech.mp3')));

  await runRecord({ ...options, output: promptPath });
  const transcription = await runTranscribe(baseUrl, {
    ...options,
    audio: promptPath,
    encoding: options.encoding || 'LINEAR16',
    'sample-rate': options['sample-rate'] || 16000,
  });

  const prompt = String(transcription.transcript || '').trim();
  if (!prompt) {
    throw new Error('No speech was transcribed from the recording');
  }

  console.log(`You said: ${prompt}`);
  const reply = await runChat(baseUrl, { ...options, message: prompt });
  console.log(`\nBearAdvisor: ${reply}\n`);

  await runSpeak(baseUrl, { ...options, text: reply, output: speechPath });
  if (!options['no-play']) {
    await runPlay({ audio: speechPath });
  }

  return { prompt, reply, promptPath, speechPath };
}

async function runRepl(baseUrl, options) {
  readSession(options.session);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'bearadvisor> ',
  });

  console.log('Interactive chat started. Type "exit" to quit.');
  rl.prompt();

  for await (const line of rl) {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      continue;
    }
    if (input === 'exit' || input === 'quit') {
      rl.close();
      break;
    }

    try {
      const reply = await runChat(baseUrl, { ...options, message: input });
      console.log(`\n${reply}\n`);
    } catch (error) {
      console.error(`\nError: ${error.message}\n`);
    }

    rl.prompt();
  }
}

function printAudit(audit) {
  console.log(`Overall: ${audit?.overall?.overall_status || 'UNKNOWN'}`);
  if (audit?.overall?.summary) console.log(audit.overall.summary);
  if (Array.isArray(audit?.requirements)) {
    for (const item of audit.requirements) {
      console.log(`- ${item.category}: ${item.status}`);
    }
  }
}

function printPlan(plan) {
  if (plan?.summary?.summary) {
    console.log(plan.summary.summary);
  }
  if (Array.isArray(plan?.courses)) {
    for (const course of plan.courses) {
      console.log(`- ${course.semester || 'Unscheduled'}: ${course.code} ${course.name ? `(${course.name})` : ''}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || 'help';
  const baseUrl = args['base-url'] || defaultBaseUrl;

  try {
    switch (command) {
      case 'help':
        printHelp();
        break;
      case 'analyze': {
        const result = await submitPdf(baseUrl, args);
        writeSession(result, args.session || latestSessionPath);
        console.log(formatTopLevel(result));
        console.log(`\nSaved latest session to ${args.session || latestSessionPath}`);
        break;
      }
      case 'manual': {
        const result = await submitManual(baseUrl, args);
        writeSession(result, args.session || latestSessionPath);
        console.log(formatTopLevel(result));
        console.log(`\nSaved latest session to ${args.session || latestSessionPath}`);
        break;
      }
      case 'audit': {
        const audit = await runAudit(baseUrl, args);
        printAudit(audit);
        break;
      }
      case 'schedule': {
        const plan = await runSchedule(baseUrl, args);
        printPlan(plan);
        break;
      }
      case 'chat': {
        const reply = await runChat(baseUrl, args);
        console.log(reply);
        break;
      }
      case 'speak': {
        const outputPath = await runSpeak(baseUrl, args);
        console.log(`Saved speech audio to ${outputPath}`);
        break;
      }
      case 'play': {
        const audioPath = await runPlay(args);
        console.log(`Played ${audioPath}`);
        break;
      }
      case 'record': {
        const outputPath = await runRecord(args);
        console.log(`Saved recording to ${outputPath}`);
        console.log(`Transcribe it with: npm run agent -- transcribe --audio ${outputPath}`);
        break;
      }
      case 'transcribe': {
        const result = await runTranscribe(baseUrl, args);
        console.log(result.transcript || '');
        if (result.encoding) console.log(`\nEncoding: ${result.encoding}`);
        break;
      }
      case 'voice': {
        const result = await runVoice(baseUrl, args);
        console.log(`Saved prompt audio to ${result.promptPath}`);
        console.log(`Saved reply audio to ${result.speechPath}`);
        break;
      }
      case 'repl':
        await runRepl(baseUrl, args);
        break;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

main();
