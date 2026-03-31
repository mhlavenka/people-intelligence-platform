const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType, UnderlineType, PageBreak,
  NumberFormat, convertInchesToTwip, LevelFormat,
} = require('docx');
const fs = require('fs');
const path = require('path');

// ── Helpers ──────────────────────────────────────────────────────────────────
const BRAND_NAVY   = '1B2A47';
const BRAND_BLUE   = '3A9FD6';
const BRAND_GREEN  = '27C4A0';
const BRAND_LIGHT  = 'EBF5FB';
const GRAY         = 'F5F7FA';
const DARK_GRAY    = '4A4A4A';

const h1 = (text) => new Paragraph({
  text,
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 400, after: 200 },
  run: { color: BRAND_NAVY, bold: true, size: 32 },
  thematicBreak: false,
});

const h2 = (text) => new Paragraph({
  text,
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 360, after: 120 },
  run: { color: BRAND_NAVY, size: 26 },
});

const h3 = (text) => new Paragraph({
  text,
  heading: HeadingLevel.HEADING_3,
  spacing: { before: 280, after: 80 },
  run: { color: BRAND_BLUE, size: 22 },
});

const p = (text, opts = {}) => new Paragraph({
  children: [new TextRun({ text, color: DARK_GRAY, size: 22, ...opts })],
  spacing: { after: 140 },
});

const bold = (text) => new TextRun({ text, bold: true, size: 22, color: BRAND_NAVY });
const mono = (text) => new TextRun({ text, font: 'Courier New', size: 18, color: '444444' });
const br   = ()     => new Paragraph({ children: [new TextRun('')], spacing: { after: 60 } });

const bullet = (text, level = 0) => new Paragraph({
  children: [new TextRun({ text, size: 22, color: DARK_GRAY })],
  bullet: { level },
  spacing: { after: 80 },
});

const codeBlock = (lines) => {
  const children = [];
  for (const line of lines) {
    children.push(new Paragraph({
      children: [mono(line)],
      spacing: { after: 0 },
      shading: { type: ShadingType.SOLID, fill: '1E1E1E', color: '1E1E1E' },
      indent: { left: convertInchesToTwip(0.2), right: convertInchesToTwip(0.2) },
    }));
  }
  // wrap with top/bottom padding rows
  return [
    new Paragraph({ children: [], spacing: { after: 0 }, shading: { type: ShadingType.SOLID, fill: '1E1E1E', color: '1E1E1E' } }),
    ...children,
    new Paragraph({ children: [], spacing: { after: 120 }, shading: { type: ShadingType.SOLID, fill: '1E1E1E', color: '1E1E1E' } }),
  ];
};

const inlineCode = (text) => new TextRun({
  text, font: 'Courier New', size: 18,
  shading: { type: ShadingType.SOLID, fill: 'EEEEEE', color: 'EEEEEE' },
  color: 'C7254E',
});

const noteBox = (label, text, fillColor = 'FFF8E1') => new Paragraph({
  children: [
    new TextRun({ text: `${label}  `, bold: true, size: 20, color: BRAND_NAVY }),
    new TextRun({ text, size: 20, color: DARK_GRAY }),
  ],
  spacing: { before: 100, after: 160 },
  shading: { type: ShadingType.SOLID, fill: fillColor, color: fillColor },
  indent: { left: convertInchesToTwip(0.15), right: convertInchesToTwip(0.15) },
});

const twoColTable = (rows) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: rows.map(([left, right]) => new TableRow({
    children: [
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.SOLID, fill: GRAY, color: GRAY },
        children: [new Paragraph({ children: [bold(left)], spacing: { after: 80 }, indent: { left: 80 } })],
      }),
      new TableCell({
        width: { size: 70, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [mono(right)], spacing: { after: 80 }, indent: { left: 80 } })],
      }),
    ],
  })),
});

const divider = () => new Paragraph({
  children: [],
  border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: BRAND_BLUE, space: 1 } },
  spacing: { before: 200, after: 200 },
});

// ── Document sections ─────────────────────────────────────────────────────────
const doc = new Document({
  creator: 'HeadSoft Tech',
  title: 'People Intelligence Platform — Technical How-To',
  description: 'Setup, development, build and deployment guide',
  numbering: {
    config: [{
      reference: 'numbered',
      levels: [{
        level: 0, format: LevelFormat.DECIMAL,
        text: '%1.',
        alignment: AlignmentType.LEFT,
        style: { run: { size: 22 }, paragraph: { indent: { left: 360, hanging: 360 } } },
      }],
    }],
  },
  sections: [{
    children: [
      // ── Cover ─────────────────────────────────────────────────────────────
      new Paragraph({
        children: [new TextRun({ text: 'People Intelligence Platform', bold: true, size: 56, color: BRAND_NAVY })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 1200, after: 200 },
      }),
      new Paragraph({
        children: [new TextRun({ text: 'Technical How-To Guide', size: 32, color: BRAND_BLUE })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
      }),
      new Paragraph({
        children: [new TextRun({ text: 'Setup · Development · Build · Deployment', size: 24, color: '888888' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 800 },
      }),
      twoColTable([
        ['Project',   'People Intelligence Platform (PIP)'],
        ['Client',    'HeadSoft Tech × Helena Coaching'],
        ['Prepared',  'March 2026'],
        ['Version',   '1.0'],
        ['Live URL',  'https://pip.helenacoaching.com'],
      ]),
      br(), br(),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 1. Overview ───────────────────────────────────────────────────────
      h1('1. System Overview'),
      p('People Intelligence Platform (PIP) is a multi-tenant B2B SaaS application built for organizational coaching and people analytics. It covers three core modules: Conflict Intelligence, Neuroinclusion Assessment, and Leadership & Succession.'),
      br(),
      h2('1.1 Architecture'),
      twoColTable([
        ['Frontend',    'Angular 17+ (standalone components, signals)'],
        ['Backend',     'Node.js 20 + Express + TypeScript strict mode'],
        ['Database',    'MongoDB Atlas (mongoose, multi-tenant via organizationId)'],
        ['AI Engine',   'Anthropic Claude API (claude-sonnet-4-6)'],
        ['Auth',        'JWT (15 min access) + refresh tokens (7 days)'],
        ['Email',       'AWS SES via nodemailer'],
        ['Storage',     'AWS S3 (file uploads), base64 for logos'],
        ['Payments',    'Stripe'],
        ['Hosting',     'AWS EC2 Amazon Linux + Apache reverse proxy + PM2'],
      ]),
      br(),
      h2('1.2 Repository Layout'),
      ...codeBlock([
        'people-intelligence-platform/',
        '├── frontend/          # Angular application',
        '│   ├── src/',
        '│   │   ├── app/',
        '│   │   │   ├── core/          # services, guards, interceptors',
        '│   │   │   └── modules/       # feature modules (auth, billing, …)',
        '│   │   └── environments/      # environment.ts / environment.prod.ts',
        '│   ├── angular.json',
        '│   └── package.json',
        '├── backend/',
        '│   ├── src/',
        '│   │   ├── config/            # env.ts, database.ts',
        '│   │   ├── controllers/',
        '│   │   ├── middleware/',
        '│   │   ├── models/',
        '│   │   ├── routes/',
        '│   │   ├── scripts/           # seed-admin.ts, seed-surveys.ts',
        '│   │   └── services/',
        '│   ├── ecosystem.config.js    # PM2 config',
        '│   ├── tsconfig.json',
        '│   ├── tsconfig.build.json    # production build (no .d.ts / sourcemaps)',
        '│   └── package.json',
        '├── documentation/',
        '├── deploy.sh                  # automated deploy script',
        '└── docker-compose.yml         # optional local Docker stack',
      ]),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 2. Prerequisites ──────────────────────────────────────────────────
      h1('2. Prerequisites'),
      h2('2.1 Local Machine'),
      twoColTable([
        ['Node.js',    '≥ 20.x  (check: node --version)'],
        ['npm',        '≥ 10.x  (check: npm --version)'],
        ['Angular CLI','npm install -g @angular/cli'],
        ['Git',        '≥ 2.x'],
        ['WebStorm',   '2023.3+ recommended'],
        ['MongoDB',    'Atlas account or local mongod for dev'],
      ]),
      br(),
      h2('2.2 Environment Variables'),
      p('Create a .env file in the backend/ folder (never commit this file):'),
      ...codeBlock([
        '# backend/.env',
        'NODE_ENV=development',
        'PORT=3030',
        'FRONTEND_URL=http://localhost:4200',
        '',
        'MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/pip',
        '',
        'JWT_SECRET=<long-random-string>',
        'JWT_EXPIRES_IN=15m',
        'JWT_REFRESH_SECRET=<another-long-random-string>',
        'JWT_REFRESH_EXPIRES_IN=7d',
        '',
        'ANTHROPIC_API_KEY=sk-ant-...',
        '',
        'AWS_REGION=us-east-1',
        'AWS_ACCESS_KEY_ID=...',
        'AWS_SECRET_ACCESS_KEY=...',
        'AWS_S3_BUCKET=pip-uploads',
        'AWS_SES_FROM_EMAIL=noreply@helenacoaching.com',
        '',
        'STRIPE_SECRET_KEY=sk_live_...',
        'STRIPE_WEBHOOK_SECRET=whsec_...',
      ]),
      noteBox('⚠ Note:', 'backend/.env is already listed in .gitignore. Never commit real secrets.', 'FFF3CD'),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 3. Local Development ──────────────────────────────────────────────
      h1('3. Running Locally'),
      h2('3.1 Clone & Install'),
      ...codeBlock([
        'git clone https://github.com/mhlavenka/people-intelligence-platform.git',
        'cd people-intelligence-platform',
        '',
        '# Install backend dependencies',
        'cd backend && npm install',
        '',
        '# Install frontend dependencies',
        'cd ../frontend && npm install',
      ]),
      br(),
      h2('3.2 Start the Backend'),
      ...codeBlock([
        'cd backend',
        'npm run dev',
        '# → ts-node-dev watches src/ and restarts on changes',
        '# → API available at http://localhost:3030/api',
      ]),
      br(),
      h2('3.3 Start the Frontend'),
      ...codeBlock([
        'cd frontend',
        'npx ng serve',
        '# → App available at http://localhost:4200',
        '# → Proxy: /api → http://localhost:3030/api  (see proxy.conf.json)',
      ]),
      noteBox('ℹ Info:', 'The Angular dev server proxies /api calls to the backend automatically via proxy.conf.json. You do not need to change any URLs.', BRAND_LIGHT),
      br(),
      h2('3.4 Seed Initial Data'),
      p('Run once after setting up a fresh database:'),
      ...codeBlock([
        '# Create the first super-admin user',
        'cd backend && npm run seed:admin',
        '',
        '# Seed global survey templates (all 5 templates, 94 questions)',
        'cd backend && npm run seed:surveys',
      ]),
      br(),
      h2('3.5 Opening in WebStorm'),
      bullet('Open the repo root folder in WebStorm (File → Open).'),
      bullet('WebStorm will detect both package.json files automatically.'),
      bullet('Go to Run → Edit Configurations → + → npm:'),
      bullet('Name: Backend Dev | package.json: backend/package.json | Script: dev', 1),
      bullet('Name: Frontend Dev | package.json: frontend/package.json | Script: start (or use ng serve)', 1),
      bullet('Run both configs simultaneously using the Services panel (View → Tool Windows → Services).'),
      bullet('Enable TypeScript service: Settings → Languages → TypeScript → Use TypeScript from node_modules.'),
      bullet('For Angular: install the Angular and Angular CLI plugins from the WebStorm Marketplace.'),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 4. Building for Production ────────────────────────────────────────
      h1('4. Building for Production'),
      h2('4.1 Frontend Build'),
      ...codeBlock([
        'cd frontend',
        'npx ng build --configuration production',
        '# Output: frontend/dist/people-intelligence-frontend/browser/',
      ]),
      p('The production build uses src/environments/environment.prod.ts which sets apiUrl to the relative path /api — this routes through Apache\'s reverse proxy on the server.'),
      br(),
      h2('4.2 Backend Build'),
      p('The backend uses a separate tsconfig.build.json that disables declaration files and source maps for faster compilation:'),
      ...codeBlock([
        'cd backend',
        'npm run build',
        '# → tsc -p tsconfig.build.json',
        '# Output: backend/dist/',
      ]),
      noteBox('ℹ Info:', 'tsconfig.build.json extends the base tsconfig but sets declaration: false, declarationMap: false, sourceMap: false. This dramatically speeds up builds on low-RAM servers (e.g. t2.micro EC2).', BRAND_LIGHT),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 5. Deployment ─────────────────────────────────────────────────────
      h1('5. Deployment to EC2'),
      h2('5.1 Server Requirements'),
      twoColTable([
        ['OS',        'Amazon Linux 2023'],
        ['Web server','Apache 2.4 (httpd)'],
        ['Node',      '≥ 20.x (installed via nvm)'],
        ['PM2',       'npm install -g pm2'],
        ['PEM key',   'headsoft-aws.pem (stored locally, never committed)'],
      ]),
      br(),
      h2('5.2 Automated Deploy Script'),
      p('The repository includes deploy.sh in the project root. It handles the entire build + upload + restart cycle in one command.'),
      ...codeBlock([
        '# Full deploy: frontend + backend',
        './deploy.sh',
        '',
        '# Frontend only (CSS / template changes)',
        './deploy.sh frontend',
        '',
        '# Backend only (API / model changes)',
        './deploy.sh backend',
      ]),
      p('The script performs these steps:'),
      bullet('Frontend: ng build --configuration production → scp browser/ to /opt/apps/pip/frontend/public/'),
      bullet('Backend: npm run build (local tsc) → scp dist/ + package.json to server → npm install --omit=dev → pm2 restart pip-backend'),
      br(),
      h2('5.3 Manual Deploy (step by step)'),
      h3('5.3.1 Upload Frontend'),
      ...codeBlock([
        'cd frontend',
        'npx ng build --configuration production',
        'scp -i headsoft-aws.pem -r dist/people-intelligence-frontend/browser/. \\',
        '  ec2-user@13.218.6.173:/opt/apps/pip/frontend/public/',
      ]),
      h3('5.3.2 Upload & Restart Backend'),
      ...codeBlock([
        'cd backend',
        'npm run build',
        'scp -i headsoft-aws.pem -r dist/. ec2-user@13.218.6.173:/opt/apps/pip/backend/dist/',
        'scp -i headsoft-aws.pem package.json package-lock.json ec2-user@13.218.6.173:/opt/apps/pip/backend/',
        'ssh -i headsoft-aws.pem ec2-user@13.218.6.173 \\',
        '  "cd /opt/apps/pip/backend && npm install --omit=dev && pm2 restart pip-backend && pm2 save"',
      ]),
      br(),
      h2('5.4 PM2 Process Management'),
      p('The backend runs under PM2 using ecosystem.config.js:'),
      ...codeBlock([
        '# Check status',
        'pm2 status',
        '',
        '# View logs',
        'pm2 logs pip-backend',
        'pm2 logs pip-backend --lines 100',
        '',
        '# Restart / reload',
        'pm2 restart pip-backend',
        'pm2 reload pip-backend   # zero-downtime reload',
        '',
        '# Start for the first time (on the server)',
        'cd /opt/apps/pip/backend',
        'pm2 start ecosystem.config.js --env production',
        'pm2 save',
        'pm2 startup              # enable auto-start on reboot',
      ]),
      br(),
      h2('5.5 Apache Configuration'),
      p('Apache acts as a reverse proxy: it serves the Angular SPA and forwards /api/* to Node.js on port 3030.'),
      ...codeBlock([
        '# /etc/httpd/conf.d/pip.conf',
        '<VirtualHost *:443>',
        '  ServerName pip.helenacoaching.com',
        '',
        '  DocumentRoot /opt/apps/pip/frontend/public',
        '',
        '  # Angular SPA routing',
        '  <Directory "/opt/apps/pip/frontend/public">',
        '    Options -Indexes',
        '    AllowOverride None',
        '    Require all granted',
        '    FallbackResource /index.html',
        '  </Directory>',
        '',
        '  # Backend API proxy',
        '  ProxyPreserveHost On',
        '  ProxyPass /api http://localhost:3030/api',
        '  ProxyPassReverse /api http://localhost:3030/api',
        '',
        '  # SSL (managed by Certbot / ACM)',
        '  SSLEngine on',
        '  SSLCertificateFile    /etc/letsencrypt/live/pip.helenacoaching.com/fullchain.pem',
        '  SSLCertificateKeyFile /etc/letsencrypt/live/pip.helenacoaching.com/privkey.pem',
        '</VirtualHost>',
      ]),
      ...codeBlock([
        '# Reload Apache after config changes',
        'sudo systemctl reload httpd',
      ]),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 6. First-time Server Setup ────────────────────────────────────────
      h1('6. First-time Server Setup'),
      p('Run these commands once on a fresh EC2 Amazon Linux instance:'),
      h2('6.1 Install Node.js via nvm'),
      ...codeBlock([
        'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash',
        'source ~/.bashrc',
        'nvm install 20',
        'nvm use 20',
        'node --version   # should print v20.x.x',
      ]),
      h2('6.2 Install PM2 and Apache'),
      ...codeBlock([
        'npm install -g pm2',
        'sudo yum install -y httpd mod_ssl',
        'sudo systemctl enable httpd',
        'sudo systemctl start httpd',
      ]),
      h2('6.3 Enable Apache Proxy Modules'),
      ...codeBlock([
        'sudo yum install -y mod_proxy mod_proxy_http',
        '# These are usually already enabled on Amazon Linux',
      ]),
      h2('6.4 Create App Directories'),
      ...codeBlock([
        'sudo mkdir -p /opt/apps/pip/frontend/public',
        'sudo mkdir -p /opt/apps/pip/backend',
        'sudo chown -R ec2-user:ec2-user /opt/apps/pip',
      ]),
      h2('6.5 Copy .env to Server'),
      ...codeBlock([
        '# Run from your local machine',
        'scp -i headsoft-aws.pem backend/.env ec2-user@13.218.6.173:/opt/apps/pip/backend/.env',
      ]),
      h2('6.6 Initial Backend Start'),
      ...codeBlock([
        '# After first deploy (deploy.sh backend), start PM2:',
        'cd /opt/apps/pip/backend',
        'pm2 start ecosystem.config.js --env production',
        'pm2 save',
        'pm2 startup   # follow the printed command to enable auto-start',
      ]),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 7. Environment Config ─────────────────────────────────────────────
      h1('7. Environment Configuration'),
      h2('7.1 Frontend Environments'),
      twoColTable([
        ['Development', 'src/environments/environment.ts → apiUrl: "http://localhost:3030/api"'],
        ['Production',  'src/environments/environment.prod.ts → apiUrl: "/api" (relative, via Apache proxy)'],
      ]),
      p('Angular automatically selects the correct environment file based on the build configuration:'),
      ...codeBlock([
        'npx ng serve                            # uses environment.ts',
        'npx ng build --configuration production # uses environment.prod.ts',
      ]),
      br(),
      h2('7.2 Backend Config (backend/src/config/env.ts)'),
      p('All configuration is read from environment variables with sensible defaults:'),
      twoColTable([
        ['PORT',                   '3030'],
        ['NODE_ENV',               'development'],
        ['JWT_EXPIRES_IN',         '15m'],
        ['JWT_REFRESH_EXPIRES_IN', '7d'],
        ['AWS_REGION',             'us-east-1'],
      ]),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 8. Key Architectural Decisions ────────────────────────────────────
      h1('8. Key Architectural Decisions'),
      h2('8.1 Multi-tenancy'),
      p('Every MongoDB document (except global templates and admin-level entities) carries an organizationId field. The tenantFilter mongoose plugin warns at runtime if a query is issued without this filter. All API routes go through the auth middleware which injects req.user.organizationId from the JWT.'),
      br(),
      h2('8.2 JWT Auth Flow'),
      bullet('Access token: 15 minute lifetime, sent in Authorization: Bearer <token> header.'),
      bullet('Refresh token: 7 day lifetime, stored in the database, used to obtain a new access token.'),
      bullet('Angular authInterceptor automatically intercepts 401 responses, calls /auth/refresh, and retries the original request.'),
      br(),
      h2('8.3 Survey Privacy — Minimum Group Size'),
      p('Survey response aggregation enforces a minimum group size of 5 respondents. Raw individual responses are never returned to prevent de-anonymisation.'),
      br(),
      h2('8.4 Global Survey Templates'),
      p('Survey templates can be either org-scoped (organizationId set) or global (isGlobal: true, no organizationId). The survey route queries both: { $or: [{ organizationId }, { isGlobal: true }] }. Global templates are seeded via npm run seed:surveys.'),
      br(),
      h2('8.5 Organization Logo Storage'),
      p('Logos are stored as base64 Data URLs directly in MongoDB (logoUrl field on the Organization model). The client validates a 2 MB maximum before upload. No S3 bucket is used for logos.'),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 9. NPM Scripts Reference ──────────────────────────────────────────
      h1('9. NPM Scripts Reference'),
      h2('9.1 Backend (backend/)'),
      twoColTable([
        ['npm run dev',           'Start ts-node-dev with hot reload (development)'],
        ['npm run build',         'Compile TypeScript with tsconfig.build.json'],
        ['npm start',             'Run compiled dist/app.js (production)'],
        ['npm run seed:admin',    'Create first super-admin user in MongoDB'],
        ['npm run seed:surveys',  'Seed 5 global survey templates (94 questions)'],
        ['npm run lint',          'Run ESLint on src/'],
        ['npm run deploy',        'Build + pm2 restart (run from server)'],
      ]),
      br(),
      h2('9.2 Frontend (frontend/)'),
      twoColTable([
        ['npx ng serve',                          'Start dev server on :4200 with proxy'],
        ['npx ng build --configuration production','Production build → dist/'],
        ['npx ng lint',                            'Run ESLint'],
        ['npx ng test',                            'Run unit tests (Karma)'],
      ]),
      new Paragraph({ children: [new PageBreak()] }),

      // ── 10. Troubleshooting ───────────────────────────────────────────────
      h1('10. Troubleshooting'),
      h2('10.1 Login calls localhost instead of the real API'),
      p('Cause: Frontend was built without --configuration production, so environment.ts (dev) was used.'),
      p('Fix:'),
      ...codeBlock([
        'cd frontend',
        'npx ng build --configuration production',
        './deploy.sh frontend   # or scp manually',
      ]),
      br(),
      h2('10.2 PM2 picks bun interpreter'),
      p('Cause: pm2 start src/app.ts — PM2 detects .ts extension and tries to use bun.'),
      p('Fix: Always start via ecosystem.config.js which explicitly sets interpreter: "node" and script: "dist/app.js".'),
      ...codeBlock([
        'pm2 start ecosystem.config.js --env production',
      ]),
      br(),
      h2('10.3 tsc hangs or runs out of memory on EC2'),
      p('Cause: Full tsconfig.json with declaration: true + declarationMap: true generates extra files, slow on t2.micro.'),
      p('Fix: Always use npm run build which invokes tsc -p tsconfig.build.json (declaration and sourcemaps disabled).'),
      br(),
      h2('10.4 Survey templates not visible'),
      p('Cause: Templates were seeded with an organizationId, making them invisible to other orgs.'),
      p('Fix: Re-run npm run seed:surveys to recreate them with isGlobal: true.'),
      br(),
      h2('10.5 CORS errors in development'),
      p('Cause: Direct API calls bypassing the Angular dev proxy.'),
      p('Fix: Ensure frontend/proxy.conf.json is configured and ng serve is started with --proxy-config proxy.conf.json (this is already wired in angular.json).'),
      br(),
      h2('10.6 MongoDB connection refused'),
      p('Verify MONGODB_URI in backend/.env is correct and your IP is whitelisted in MongoDB Atlas (Network Access → Add IP Address).'),

      br(), br(),
      divider(),
      new Paragraph({
        children: [new TextRun({ text: 'People Intelligence Platform © 2026 HeadSoft Tech. Internal use only.', size: 18, color: '999999' })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
      }),
    ],
  }],
});

const outputPath = path.join(__dirname, '..', 'technical-howto.docx');
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  console.log('Generated: ' + outputPath);
});
