"""Regenerate the public resume: pip install reportlab; python scripts/build_resume.py.

Content verified against the supplied LinkedIn export and public project READMEs,
September 23, 2026. The private LinkedIn export is not included in this repository.
"""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable


ROOT = Path(__file__).resolve().parents[1]
INK = colors.HexColor('#25251f')
RED = colors.HexColor('#b93422')
styles = {
    'name': ParagraphStyle('name', fontName='Helvetica-Bold', fontSize=26, leading=30, textColor=INK),
    'role': ParagraphStyle('role', fontName='Helvetica', fontSize=12, leading=17, textColor=RED),
    'body': ParagraphStyle('body', fontName='Helvetica', fontSize=9, leading=12, textColor=INK, spaceAfter=5),
    'small': ParagraphStyle('small', fontName='Helvetica', fontSize=8, leading=11, textColor=INK, spaceAfter=5),
    'section': ParagraphStyle('section', fontName='Helvetica-Bold', fontSize=10, leading=14, textColor=RED, spaceBefore=10, spaceAfter=6),
    'entry': ParagraphStyle('entry', fontName='Helvetica-Bold', fontSize=10, leading=14, textColor=INK, spaceAfter=3),
}
story = []


def add(text, style='body'):
    story.append(Paragraph(text, styles[style]))


def section(title):
    add(title.upper(), 'section')


add('Muhammad Rayyan', 'name')
add('Full-Stack Developer | Lahore, Pakistan', 'role')
add('<link href="mailto:rayyan.scale@gmail.com">rayyan.scale@gmail.com</link>  |  '
    '<link href="https://www.rayyandev.tech">rayyandev.tech</link>  |  '
    '<link href="https://github.com/mrayyan911">github.com/mrayyan911</link>', 'small')
add('<link href="https://www.linkedin.com/in/muhammadrayyan911/">linkedin.com/in/muhammadrayyan911</link>', 'small')
story.append(HRFlowable(width='100%', thickness=.6, color=colors.HexColor('#cccac1')))
story.append(Spacer(1, 8))
add('Full-stack developer building web applications, developer tools, and AI systems. '
    'Experience with React, Next.js, Node.js, Python APIs, PostgreSQL, and containerized deployments.')

section('Experience')
add('Journal Post Group | Full Stack Developer', 'entry')
add('July 2026 - Present | Lahore', 'small')
add('Building JournalPost.com, a viral media platform. Developing the Next.js frontend, '
    'using Payload CMS for editorial content management, and Supabase Postgres for the database. '
    'Focused on fast-loading, shareable content and a flexible publishing workflow.')
add('Voliom | AI/ML Intern', 'entry')
add('June 2025 - September 2025 | Rawalpindi', 'small')
add('Developed a computer vision platform backend with FastAPI and PostgreSQL under senior-developer mentorship. '
    'Implemented Firebase authentication, email verification, JWT security, dataset management, and image storage. '
    'Integrated Vertex AI for text-to-image generation and image-to-text analysis; used SQLAlchemy and Docker.')

section('Selected projects')
add('<link href="https://journalpost.com">JournalPost.com</link> | Next.js, Payload CMS, Supabase Postgres', 'entry')
add('Current professional project: a viral media platform connecting the reader experience, editorial workflow, and database.')
add('<link href="https://github.com/mrayyan911/usage-pill">Usage Pill</link> | JavaScript, Electron, Node.js', 'entry')
add('Always-on-top desktop overlay for Claude Code and Codex usage. Supports agent activity, reset times, '
    'multi-display positioning, keyboard access, and automatic session monitoring on Windows.')
add('<link href="https://github.com/mrayyan911/Imagenix">Imagenix</link> | Next.js, NestJS, FastAPI, PyTorch', 'entry')
add('Image dataset platform for annotation, generative augmentation, and export. Integrates Grounding DINO, '
    'Stable Diffusion, and ControlNet; uses PostgreSQL, Redis, BullMQ, and MinIO across a three-service monorepo.')

section('Skills')
add('<b>Frontend:</b> React, Next.js, TypeScript, JavaScript, HTML, CSS, Tailwind CSS, Payload CMS<br/>'
    '<b>Backend and data:</b> Node.js, NestJS, Python, FastAPI, Django, PostgreSQL, MongoDB, Redis, Prisma, SQLAlchemy<br/>'
    '<b>AI:</b> PyTorch, Stable Diffusion, ControlNet, Grounding DINO, Google Vertex AI<br/>'
    '<b>Delivery:</b> Docker, CI/CD, Git, Supabase, Firebase, Vercel, Railway, Render, Electron')

section('Education and certifications')
add("Bachelor's degree, Data Science | KFUEIT | August 2022 - June 2026", 'entry')
add('Khwaja Fareed University of Engineering and Information Technology', 'small')
add('Python Programming for All Levels; Google AI Essentials; What is Data Science?; '
    'Data Science Methodology; Tools for Data Science.', 'small')

document = SimpleDocTemplate(str(ROOT / 'MuhammadRayyan-Resume.pdf'), pagesize=A4,
    rightMargin=40, leftMargin=40, topMargin=35, bottomMargin=30,
    title='Muhammad Rayyan - Full-Stack Developer', author='Muhammad Rayyan')
document.build(story)
print('Generated MuhammadRayyan-Resume.pdf')
