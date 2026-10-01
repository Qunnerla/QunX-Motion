# Security

QunX Motion is a Claude skill: instructions, an HTML template and local Node / Python scripts. It runs no server and collects no data.

## What the skill touches

- **Clips** are single HTML files that load GSAP from cdnjs and fonts from Google Fonts. Nothing else is sent anywhere.
- **Scripts** (`scripts/*.js`, `vectorize.py`) run on your own machine and read only the files and URLs you pass them (`brand.js` reads the website you name).
- The skill never asks for passwords, API keys or tokens. If a copy of it does, it is not the original: get the skill from this repository.

## Reporting a problem

Found a security issue, or a copy of QunX Motion that has been changed to do something harmful? Open a [private security advisory](https://github.com/Qunnerla/QunX-Motion/security/advisories/new) in this repository, or an issue if it is not sensitive.

Only the versions published in this repository's [Releases](https://github.com/Qunnerla/QunX-Motion/releases) are supported.
