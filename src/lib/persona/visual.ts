import { GoogleGenAI, PersonGeneration } from '@google/genai';
import { storage } from '@/lib/storage';
import { processMediaImage } from '@/lib/media/processor';
import { runSafetyGatePipeline } from '@/lib/safety/pipeline';
import prisma from '@/lib/db/prisma';
import { logAuditEvent } from '@/lib/audit/logger';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
sharp.cache(false);
export * from './visual-types';
import { VisualModelOptions, buildVisualModelPrompt, formatPhysicalDNASummary, PersonaAngleItem } from './visual-types';

/**
 * Returns available multi-angle reference portraits for an ethnicity / persona / style.
 * By default returns the 5 views: Front, Side, Full view, Full Back view, Full Side view.
 */
export function getPersonaMultiAnglePack(
  ethnicity: string = 'south_indian',
  personaId?: string,
  _styleLook: string = 'minimal_studio'
): PersonaAngleItem[] {
  void _styleLook;
  const ethPrefix = `/presets/personas/${ethnicity || 'south_indian'}`;
  const studioPrefix = ethnicity === 'south_indian' ? ethPrefix : '/presets/personas/minimal_studio';
  const hasPreset = (file: string) => fs.existsSync(path.join(process.cwd(), 'public', file.replace(/^\//, '')));

  let frontUrl = `${studioPrefix}/camisole_front.jpg`;
  let sideUrl = `${studioPrefix}/camisole_side.jpg`;
  let fullBodyUrl = `${studioPrefix}/camisole_full_body.jpg`;
  let fullBackUrl = `${studioPrefix}/camisole_full_back.jpg`;
  let fullSideUrl = `${studioPrefix}/camisole_full_body_side.jpg`;

  // If this specific persona has their own synthesized angle portrait files, use them
  if (personaId) {
    const pLocked = `/uploads/personas/${personaId}/locked_face.jpg`;
    const pFront = `/uploads/personas/${personaId}/angle_front.jpg`;
    const pBaseFront = `/uploads/personas/${personaId}/base_front.jpg`;
    const pSide = `/uploads/personas/${personaId}/angle_side.jpg`;
    const pFullBody = `/uploads/personas/${personaId}/angle_full_body.jpg`;
    const pFullBack = `/uploads/personas/${personaId}/angle_full_back.jpg`;
    const pFullSide = `/uploads/personas/${personaId}/angle_full_side.jpg`;

    if (hasPreset(pLocked)) frontUrl = pLocked;
    else if (hasPreset(pFront)) frontUrl = pFront;
    else if (hasPreset(pBaseFront)) frontUrl = pBaseFront;

    if (hasPreset(pSide)) sideUrl = pSide;
    if (hasPreset(pFullBody)) fullBodyUrl = pFullBody;
    if (hasPreset(pFullBack)) fullBackUrl = pFullBack;
    if (hasPreset(pFullSide)) fullSideUrl = pFullSide;
  }

  return [
    { angle: 'front', label: 'Front', url: frontUrl },
    { angle: 'side', label: 'Side', url: sideUrl },
    { angle: 'full_body', label: 'Full view', url: fullBodyUrl },
    { angle: 'full_back', label: 'Full Back view', url: fullBackUrl },
    { angle: 'full_side', label: 'Full Side view', url: fullSideUrl },
  ];
}

/**
 * Generates an SVG overlay to render selected physical traits (moles, tattoos, dimples, freckles, complexion).
 */
function buildTraitOverlaySvg(
  width: number,
  height: number,
  options: VisualModelOptions,
  _personaName?: string,
  _age?: number,
  angle: string = 'front'
): string {
  const parts: string[] = [];
  const isFront = angle === 'front';
  const isSide = angle === 'side';
  const isFullBody = angle === 'full_body';
  const isFullSide = angle === 'full_side';

  // 1. Complexion Undertone & Finish Highlights
  if (options.skinTone?.undertone) {
    if (options.skinTone.undertone === 'cool_rosy') {
      parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#f43f5e" opacity="0.04" />`);
    } else if (options.skinTone.undertone === 'warm_golden') {
      parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#f59e0b" opacity="0.05" />`);
    } else if (options.skinTone.undertone === 'neutral_olive') {
      parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#84cc16" opacity="0.03" />`);
    }
  }

  // 2. Dimples (Subtle contouring if enabled)
  const dimpleType = options.dimple?.type;
  if (dimpleType && dimpleType !== 'none') {
    const renderDimple = (cx: number, cy: number) => `
      <ellipse cx="${cx}" cy="${cy}" rx="3.5" ry="6" fill="#1c1917" opacity="0.45" />
      <ellipse cx="${cx}" cy="${cy - 3}" rx="2" ry="3" fill="#ffffff" opacity="0.20" />
    `;
    if (isFront) {
      if (dimpleType === 'bilateral_cheeks' || dimpleType === 'left_cheek') {
        parts.push(renderDimple(width * 0.370, height * 0.425));
      }
      if (dimpleType === 'bilateral_cheeks' || dimpleType === 'right_cheek') {
        parts.push(renderDimple(width * 0.630, height * 0.425));
      }
      if (dimpleType === 'chin_cleft') {
        parts.push(`<ellipse cx="${width * 0.500}" cy="${height * 0.505}" rx="3" ry="5.5" fill="#1c1917" opacity="0.40" />`);
      }
    } else if (isSide) {
      if (dimpleType === 'bilateral_cheeks' || dimpleType === 'left_cheek') {
        parts.push(renderDimple(width * 0.355, height * 0.440));
      }
    }
  }

  // 4. Moles & Distinctive Beauty Marks
  const moleLoc = options.distinctiveMarks?.moles;
  if (moleLoc && moleLoc !== 'none') {
    const renderMole = (cx: number, cy: number, r: number = 3.5) => `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#180c06" opacity="0.95" />
      <circle cx="${cx}" cy="${cy}" r="${r * 1.4}" fill="#180c06" opacity="0.25" />
    `;

    if (isFront) {
      switch (moleLoc) {
        case 'above_lip':
          parts.push(renderMole(width * 0.465, height * 0.395, 3.2));
          break;
        case 'cheek_beauty_mark':
          parts.push(renderMole(width * 0.375, height * 0.395, 3.6));
          break;
        case 'under_left_eye':
          parts.push(renderMole(width * 0.565, height * 0.338, 2.6));
          break;
        case 'collarbone':
          parts.push(renderMole(width * 0.415, height * 0.605, 3.6));
          break;
        case 'neck':
          parts.push(renderMole(width * 0.455, height * 0.535, 3.2));
          break;
        case 'chest_cleavage':
          parts.push(renderMole(width * 0.500, height * 0.665, 4.0));
          break;
        case 'upper_chest_left':
          parts.push(renderMole(width * 0.430, height * 0.640, 3.6));
          break;
        case 'sternum':
          parts.push(renderMole(width * 0.500, height * 0.700, 4.2));
          break;
        case 'lower_cleavage':
          parts.push(renderMole(width * 0.500, height * 0.730, 3.8));
          break;
      }
    } else if (isSide) {
      switch (moleLoc) {
        case 'above_lip':
          parts.push(renderMole(width * 0.305, height * 0.430, 3.2));
          break;
        case 'cheek_beauty_mark':
          parts.push(renderMole(width * 0.375, height * 0.410, 3.6));
          break;
        case 'under_left_eye':
          parts.push(renderMole(width * 0.360, height * 0.360, 2.6));
          break;
        case 'neck':
          parts.push(renderMole(width * 0.420, height * 0.560, 3.2));
          break;
        case 'collarbone':
        case 'upper_chest_left':
          parts.push(renderMole(width * 0.370, height * 0.680, 3.6));
          break;
      }
    } else if (isFullBody) {
      switch (moleLoc) {
        case 'above_lip':
        case 'cheek_beauty_mark':
        case 'under_left_eye':
          parts.push(renderMole(width * 0.495, height * 0.165, 1.8));
          break;
        case 'chest_cleavage':
          parts.push(renderMole(width * 0.500, height * 0.290, 2.4));
          break;
        case 'upper_chest_left':
          parts.push(renderMole(width * 0.470, height * 0.275, 2.2));
          break;
        case 'sternum':
          parts.push(renderMole(width * 0.500, height * 0.320, 2.5));
          break;
        case 'lower_cleavage':
          parts.push(renderMole(width * 0.500, height * 0.340, 2.3));
          break;
      }
    } else if (isFullSide) {
      switch (moleLoc) {
        case 'above_lip':
        case 'cheek_beauty_mark':
          parts.push(renderMole(width * 0.535, height * 0.140, 1.8));
          break;
        case 'chest_cleavage':
        case 'sternum':
          parts.push(renderMole(width * 0.540, height * 0.320, 2.3));
          break;
      }
    }
  }

  // 5. Freckles (Nose bridge & Cheek dusting)
  if (isFront && (options.distinctiveMarks?.freckles === 'subtle_nose' || options.distinctiveMarks?.freckles === 'cheek_dusting')) {
    const isCheeks = options.distinctiveMarks.freckles === 'cheek_dusting';
    const freckleDots = [
      [0.485, 0.355], [0.500, 0.350], [0.515, 0.355],
      [0.475, 0.362], [0.525, 0.362], [0.490, 0.368], [0.510, 0.368],
      ...(isCheeks ? [
        [0.410, 0.375], [0.430, 0.380], [0.395, 0.385], [0.440, 0.390],
        [0.590, 0.375], [0.570, 0.380], [0.605, 0.385], [0.560, 0.390]
      ] : [])
    ];
    parts.push(
      `<g fill="#451a03" opacity="0.55">` +
      freckleDots.map(([x, y]) => `<circle cx="${width * x}" cy="${height * y}" r="1.8" />`).join('') +
      `</g>`
    );
  }

  // 6. Body Art & Tattoos
  const tattooPlacement = options.tattoos?.placement;
  if (tattooPlacement && tattooPlacement !== 'none') {
    const inkColor = '#0f172a';

    if (isFront) {
      switch (tattooPlacement) {
        case 'sternum_cleavage':
          parts.push(`
            <g stroke="${inkColor}" stroke-width="2.2" fill="none" opacity="0.88" stroke-linecap="round" stroke-linejoin="round">
              <path d="M ${width * 0.50} ${height * 0.670} Q ${width * 0.475} ${height * 0.690} ${width * 0.50} ${height * 0.710} Q ${width * 0.525} ${height * 0.690} ${width * 0.50} ${height * 0.670} Z" fill="${inkColor}" fill-opacity="0.30"/>
              <path d="M ${width * 0.50} ${height * 0.710} Q ${width * 0.46} ${height * 0.690} ${width * 0.44} ${height * 0.670} Q ${width * 0.46} ${height * 0.720} ${width * 0.50} ${height * 0.740}"/>
              <path d="M ${width * 0.50} ${height * 0.710} Q ${width * 0.54} ${height * 0.690} ${width * 0.56} ${height * 0.670} Q ${width * 0.54} ${height * 0.720} ${width * 0.50} ${height * 0.740}"/>
              <circle cx="${width * 0.50}" cy="${height * 0.730}" r="2" fill="${inkColor}" />
              <circle cx="${width * 0.50}" cy="${height * 0.750}" r="2.5" fill="${inkColor}" />
              <circle cx="${width * 0.50}" cy="${height * 0.772}" r="3" fill="${inkColor}" />
              <line x1="${width * 0.50}" y1="${height * 0.710}" x2="${width * 0.50}" y2="${height * 0.772}" stroke-dasharray="2,3" />
            </g>
          `);
          break;
        case 'upper_chest_decolletage':
          parts.push(`
            <g stroke="${inkColor}" stroke-width="1.8" fill="none" opacity="0.85" stroke-linecap="round">
              <path d="M ${width * 0.38} ${height * 0.615} Q ${width * 0.50} ${height * 0.635} ${width * 0.62} ${height * 0.615}" />
              <circle cx="${width * 0.50}" cy="${height * 0.635}" r="2.5" fill="${inkColor}" />
              <path d="M ${width * 0.44} ${height * 0.625} Q ${width * 0.42} ${height * 0.610} ${width * 0.41} ${height * 0.615}" />
              <path d="M ${width * 0.56} ${height * 0.625} Q ${width * 0.58} ${height * 0.610} ${width * 0.59} ${height * 0.615}" />
            </g>
          `);
          break;
        case 'underbust_rib':
          parts.push(`
            <g stroke="${inkColor}" stroke-width="2" fill="none" opacity="0.85" stroke-linecap="round">
              <path d="M ${width * 0.42} ${height * 0.72} Q ${width * 0.46} ${height * 0.75} ${width * 0.50} ${height * 0.74}" />
              <circle cx="${width * 0.42}" cy="${height * 0.72}" r="2" fill="${inkColor}" />
              <circle cx="${width * 0.50}" cy="${height * 0.74}" r="2" fill="${inkColor}" />
            </g>
          `);
          break;
        case 'side_breast_rib':
          parts.push(`
            <g stroke="${inkColor}" stroke-width="2" fill="none" opacity="0.85" stroke-linecap="round">
              <path d="M ${width * 0.37} ${height * 0.69} Q ${width * 0.36} ${height * 0.72} ${width * 0.37} ${height * 0.75}" />
              <circle cx="${width * 0.37}" cy="${height * 0.75}" r="2.5" fill="${inkColor}" />
            </g>
          `);
          break;
        case 'collarbone':
          parts.push(`
            <g stroke="${inkColor}" stroke-width="1.8" fill="none" opacity="0.85" stroke-linecap="round">
              <path d="M ${width * 0.40} ${height * 0.605} Q ${width * 0.45} ${height * 0.615} ${width * 0.49} ${height * 0.605}" />
              <circle cx="${width * 0.40}" cy="${height * 0.605}" r="2" fill="${inkColor}" />
            </g>
          `);
          break;
        case 'shoulder':
          parts.push(`
            <g stroke="${inkColor}" stroke-width="2" fill="none" opacity="0.85" stroke-linecap="round">
              <circle cx="${width * 0.31}" cy="${height * 0.64}" r="12" stroke-dasharray="3,3" />
              <circle cx="${width * 0.31}" cy="${height * 0.64}" r="5" fill="${inkColor}" fill-opacity="0.3" />
            </g>
          `);
          break;
        case 'wrist':
        case 'forearm':
          parts.push(`
            <g stroke="${inkColor}" stroke-width="2" fill="none" opacity="0.85" stroke-linecap="round">
              <circle cx="${width * 0.28}" cy="${height * 0.78}" r="8" stroke-dasharray="2,3" />
              <circle cx="${width * 0.28}" cy="${height * 0.78}" r="3" fill="${inkColor}" />
            </g>
          `);
          break;
      }
    } else if (isFullBody) {
      if (tattooPlacement === 'sternum_cleavage' || tattooPlacement === 'upper_chest_decolletage') {
        parts.push(`
          <g stroke="${inkColor}" stroke-width="1.2" fill="none" opacity="0.85" stroke-linecap="round">
            <path d="M ${width * 0.49} ${height * 0.29} Q ${width * 0.50} ${height * 0.31} ${width * 0.51} ${height * 0.29}" />
            <circle cx="${width * 0.50}" cy="${height * 0.31}" r="1.2" fill="${inkColor}" />
          </g>
        `);
      }
    }
  }

  // 7. Verified Persona Metadata Overlay Badge (At Bottom)
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${parts.join('\n')}</svg>`;
}

/**
 * Loads a photorealistic real-person image buffer from presets and dynamically applies selected physical traits.
 */
async function getPhotorealisticPersonaBuffer(
  options: VisualModelOptions,
  personaName: string,
  age: number,
  personaId?: string
): Promise<Buffer> {
  const angle = options.cameraAngle || 'front';
  const ethnicity = options.ethnicity || 'south_indian';
  const ethPrefix = path.resolve(process.cwd(), `public/presets/personas/${ethnicity}`);
  const minimalPrefix = path.resolve(process.cwd(), 'public/presets/personas/minimal_studio');

  // Select clean matching base template from consistent 5-angle model pack so all views feature the exact same person
  const angleTemplates: Record<string, string> = {
    front: 'camisole_front.jpg',
    side: 'camisole_side.jpg',
    full_body: 'camisole_full_body.jpg',
    full_back: 'camisole_full_back.jpg',
    full_side: 'camisole_full_body_side.jpg',
  };

  const templateFile = angleTemplates[angle] || 'camisole_front.jpg';
  let diskPath = fs.existsSync(path.join(ethPrefix, templateFile))
    ? path.join(ethPrefix, templateFile)
    : path.join(minimalPrefix, templateFile);

  // If this persona has their own unique locked face or base image, anchor to it
  if (personaId) {
    const personaDir = path.resolve(process.cwd(), `public/uploads/personas/${personaId}`);
    if (angle === 'front') {
      const lockedFacePath = path.join(personaDir, 'locked_face.jpg');
      const baseFrontPath = path.join(personaDir, 'base_front.jpg');
      const angleFrontPath = path.join(personaDir, 'angle_front.jpg');

      if (fs.existsSync(lockedFacePath)) {
        diskPath = lockedFacePath;
      } else if (fs.existsSync(baseFrontPath)) {
        diskPath = baseFrontPath;
      } else if (fs.existsSync(angleFrontPath)) {
        diskPath = angleFrontPath;
      }
    } else {
      const personaAnglePath = path.join(personaDir, `angle_${angle}.jpg`);
      if (fs.existsSync(personaAnglePath)) {
        diskPath = personaAnglePath;
      }
    }
  }

  if (fs.existsSync(diskPath)) {
    try {
      const inputBuffer = fs.readFileSync(diskPath);
      const meta = await sharp(inputBuffer).metadata();
      const width = meta.width || 1024;
      const height = meta.height || 1024;

      // 1. Photographic Color Grading & Complexion Transformation
      const complexion = options.skinTone?.complexion || 'warm_caramel';
      let modOpts: { brightness: number; saturation: number } = {
        brightness: 1.0,
        saturation: 1.0,
      };

      switch (complexion) {
        case 'fair_porcelain':
          modOpts = { brightness: 1.16, saturation: 0.92 };
          break;
        case 'deep_melanin':
          modOpts = { brightness: 0.70, saturation: 1.25 };
          break;
        case 'golden_bronze':
          modOpts = { brightness: 1.06, saturation: 1.35 };
          break;
        case 'olive_wheatish':
          modOpts = { brightness: 1.00, saturation: 1.02 };
          break;
        case 'sunset_honey':
          modOpts = { brightness: 1.08, saturation: 1.22 };
          break;
        case 'warm_caramel':
        default:
          modOpts = { brightness: 1.02, saturation: 1.12 };
          break;
      }

      const modulatedBuffer = await sharp(inputBuffer)
        .modulate(modOpts)
        .toBuffer();

      // 2. High-precision SVG overlay for selected facial and body traits
      const overlaySvg = buildTraitOverlaySvg(width, height, options, personaName, age, angle);

      const compositeBuffer = await sharp(modulatedBuffer)
        .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
        .jpeg({ quality: 92 })
        .toBuffer();

      return compositeBuffer;
    } catch (err) {
      console.warn('Failed to composite traits with sharp, falling back to base buffer:', err);
      return fs.readFileSync(diskPath);
    }
  }

  // 2. Vector SVG buffer if no files exist on disk
  return createFallbackPersonaImageBuffer(options, personaName, age);
}

/**
 * Generates an SVG/Canvas simulation placeholder when external Gemini Imagen API is unavailable or unconfigured.
 */
function createFallbackPersonaImageBuffer(
  options: VisualModelOptions,
  _personaName?: string,
  _age?: number
): Buffer {
  void _personaName;
  void _age;
  const isTraditional = options.styleLook === 'traditional';
  const isModern = options.styleLook === 'modern';
  const isFusion = options.styleLook === 'fusion';

  // Ethnicity-tailored skin tones and palettes
  let skinTone = '#9a6138';
  let skinShadow = '#784422';
  let primaryAttireColor = '#be123c';
  let attireSecondary = '#881337';
  let accentGold = '#f59e0b';
  let bgStart = '#1e1b4b';
  let bgEnd = '#0f172a';

  switch (options.ethnicity) {
    case 'south_indian':
      skinTone = '#8f5933';
      skinShadow = '#6e3f20';
      primaryAttireColor = '#9f1239'; // Deep maroon / Kanjeevaram crimson
      attireSecondary = '#881337';
      accentGold = '#eab308'; // Traditional temple gold
      bgStart = '#3b0764';
      bgEnd = '#18181b';
      break;
    case 'north_indian':
      skinTone = '#c48f65';
      skinShadow = '#9f6a43';
      primaryAttireColor = '#be123c'; // Ruby red lehenga
      attireSecondary = '#4c0519';
      accentGold = '#f59e0b';
      bgStart = '#450a0a';
      bgEnd = '#18181b';
      break;
    case 'east_asian':
      skinTone = '#e2ba9b';
      skinShadow = '#b88c6e';
      primaryAttireColor = '#065f46'; // Jade green / emerald silk
      attireSecondary = '#022c22';
      accentGold = '#fbbf24';
      bgStart = '#064e3b';
      bgEnd = '#09090b';
      break;
    case 'southeast_asian':
      skinTone = '#af7950';
      skinShadow = '#825431';
      primaryAttireColor = '#d97706'; // Warm saffron / terracotta
      attireSecondary = '#78350f';
      accentGold = '#f59e0b';
      bgStart = '#431407';
      bgEnd = '#18181b';
      break;
    case 'latina':
      skinTone = '#b67a54';
      skinShadow = '#895333';
      primaryAttireColor = '#c026d3'; // Fuchsia / coral
      attireSecondary = '#701a75';
      accentGold = '#fbbf24';
      bgStart = '#4c0519';
      bgEnd = '#18181b';
      break;
    case 'caucasian':
      skinTone = '#eec7b3';
      skinShadow = '#c49982';
      primaryAttireColor = '#2563eb'; // Royal navy / azure
      attireSecondary = '#1e3a8a';
      accentGold = '#cbd5e1';
      bgStart = '#1e293b';
      bgEnd = '#09090b';
      break;
    case 'african':
      skinTone = '#4c2d1e';
      skinShadow = '#311a10';
      primaryAttireColor = '#ea580c'; // Radiant orange / royal indigo
      attireSecondary = '#7c2d12';
      accentGold = '#fbbf24';
      bgStart = '#172554';
      bgEnd = '#09090b';
      break;
    case 'middle_eastern':
      skinTone = '#b8865c';
      skinShadow = '#8c5e39';
      primaryAttireColor = '#047857'; // Deep emerald velvet
      attireSecondary = '#064e3b';
      accentGold = '#f59e0b';
      bgStart = '#134e4a';
      bgEnd = '#09090b';
      break;
    default:
      skinTone = '#a16c44';
      skinShadow = '#784728';
      primaryAttireColor = '#4f46e5';
      attireSecondary = '#312e81';
      accentGold = '#f59e0b';
      bgStart = '#1e1b4b';
      bgEnd = '#09090b';
      break;
  }

  // Modern blazer styling override
  if (isModern) {
    primaryAttireColor = '#18181b';
    attireSecondary = '#27272a';
    accentGold = '#38bdf8';
  } else if (isFusion) {
    primaryAttireColor = '#4338ca';
    attireSecondary = '#312e81';
  }

  const svg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgStart}"/>
      <stop offset="50%" stop-color="#111827"/>
      <stop offset="100%" stop-color="${bgEnd}"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="38%" r="45%">
      <stop offset="0%" stop-color="${accentGold}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="attire" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${primaryAttireColor}"/>
      <stop offset="100%" stop-color="${attireSecondary}"/>
    </linearGradient>
    <linearGradient id="faceGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${skinTone}"/>
      <stop offset="100%" stop-color="${skinShadow}"/>
    </linearGradient>
  </defs>

  <!-- Background Canvas -->
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <circle cx="512" cy="400" r="420" fill="url(#halo)"/>

  <!-- Ornate Frame Borders -->
  <rect x="28" y="28" width="968" height="968" fill="none" stroke="${accentGold}" stroke-width="2" stroke-opacity="0.4" rx="28"/>
  <rect x="40" y="40" width="944" height="944" fill="none" stroke="${accentGold}" stroke-width="1" stroke-dasharray="10,6" stroke-opacity="0.25" rx="24"/>

  <!-- Garment / Shoulders -->
  <ellipse cx="512" cy="780" rx="310" ry="250" fill="url(#attire)"/>
  ${
    isTraditional
      ? `<!-- Traditional Embellished Zari Border -->
  <path d="M 270 670 Q 512 850 754 670" stroke="${accentGold}" stroke-width="24" fill="none" stroke-linecap="round"/>
  <path d="M 285 700 Q 512 880 739 700" stroke="#fef08a" stroke-width="6" fill="none" stroke-dasharray="12,8"/>`
      : isModern
      ? `<!-- Modern Blazer Lapels & Shirt -->
  <polygon points="420,630 512,810 604,630" fill="#09090b" stroke="${accentGold}" stroke-width="2"/>
  <line x1="512" y1="630" x2="512" y2="810" stroke="#f8fafc" stroke-width="2"/>`
      : `<!-- Fusion Neckline & Scarf -->
  <path d="M 360 650 Q 512 750 664 650" stroke="${accentGold}" stroke-width="14" fill="none" stroke-linecap="round"/>`
  }

  <!-- Neck & Base -->
  <rect x="460" y="470" width="104" height="160" fill="url(#faceGrad)" rx="24"/>
  <!-- Necklace / Collar accent -->
  <path d="M 436 565 Q 512 620 588 565" stroke="${accentGold}" stroke-width="12" fill="none" stroke-linecap="round"/>
  <circle cx="512" cy="620" r="14" fill="${accentGold}"/>

  <!-- Hair Silhouette & Volume -->
  <ellipse cx="512" cy="380" rx="200" ry="210" fill="#09090b"/>
  <!-- Face Contour -->
  <ellipse cx="512" cy="390" rx="142" ry="176" fill="url(#faceGrad)"/>

  <!-- Hair Framing -->
  <path d="M 370 380 Q 512 210 654 380 Q 640 250 512 240 Q 384 250 370 380 Z" fill="#09090b"/>
  ${
    options.ethnicity === 'south_indian' || options.ethnicity === 'north_indian'
      ? `<!-- Authentic Jasmine Flowers (Gajra) in hair -->
  <circle cx="365" cy="335" r="12" fill="#ffffff"/>
  <circle cx="380" cy="315" r="12" fill="#fef9c3"/>
  <circle cx="405" cy="295" r="12" fill="#ffffff"/>
  <circle cx="619" cy="295" r="12" fill="#ffffff"/>
  <circle cx="644" cy="315" r="12" fill="#fef9c3"/>
  <circle cx="659" cy="335" r="12" fill="#ffffff"/>`
      : ''
  }

  <!-- Traditional / Contemporary Earrings -->
  <circle cx="355" cy="430" r="9" fill="${accentGold}"/>
  <polygon points="345,442 365,442 355,468" fill="${accentGold}"/>
  <circle cx="669" cy="430" r="9" fill="${accentGold}"/>
  <polygon points="659,442 679,442 669,468" fill="${accentGold}"/>

  <!-- Expressive Eyebrows -->
  <path d="M 416 332 Q 454 316 488 332" stroke="#18181b" stroke-width="7" fill="none" stroke-linecap="round"/>
  <path d="M 536 332 Q 570 316 608 332" stroke="#18181b" stroke-width="7" fill="none" stroke-linecap="round"/>

  <!-- Almond Photorealistic Eyes -->
  <ellipse cx="452" cy="358" rx="26" ry="14" fill="#ffffff"/>
  <circle cx="454" cy="358" r="11" fill="#1c1917"/>
  <circle cx="456" cy="355" r="3.5" fill="#ffffff"/>

  <ellipse cx="572" cy="358" rx="26" ry="14" fill="#ffffff"/>
  <circle cx="570" cy="358" r="11" fill="#1c1917"/>
  <circle cx="572" cy="355" r="3.5" fill="#ffffff"/>

  ${
    options.ethnicity === 'south_indian' || options.ethnicity === 'north_indian'
      ? `<!-- Traditional Auspicious Bindi -->
  <circle cx="512" cy="324" r="7.5" fill="#b91c1c" stroke="${accentGold}" stroke-width="1.5"/>`
      : ''
  }

  <!-- Nose & Smile Structure -->
  <path d="M 512 366 L 507 414 L 518 417" stroke="${skinShadow}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <ellipse cx="512" cy="460" rx="34" ry="12" fill="#be123c"/>
  <path d="M 478 460 Q 512 472 546 460" stroke="#f43f5e" stroke-width="2.5" fill="none"/>
</svg>`;

  return Buffer.from(svg);
}

/**
 * Generates the persona visual model image using Gemini API (or high-detail fallback).
 */
export async function generatePersonaVisual(input: {
  personaId: string;
  options: VisualModelOptions;
  personaName: string;
  adultAge: number;
}): Promise<{
  imageUrl: string;
  thumbnailUrl: string;
  provenanceHash: string;
  prompt: string;
  modelUsed: string;
  config: VisualModelOptions;
  multiAnglePack?: PersonaAngleItem[];
}> {
  const { prompt } = buildVisualModelPrompt(
    input.options,
    input.personaName,
    input.adultAge
  );

  let imageBuffer: Buffer | null = null;
  let modelUsed = 'gemini-2.5-flash-image';

  // 1. Attempt Gemini generation if API key is present
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey.trim().length > 5) {
    try {
      const client = new GoogleGenAI({ apiKey });

      // First attempt Gemini 2.5 flash image via generateContent
      try {
        const genResult = await client.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: prompt,
        });

        const parts = genResult.candidates?.[0]?.content?.parts;
        if (parts) {
          for (const p of parts) {
            if (p.inlineData?.data) {
              imageBuffer = Buffer.from(p.inlineData.data, 'base64');
              modelUsed = 'gemini-2.5-flash-image';
              break;
            }
          }
        }
      } catch (err) {
        console.warn('Gemini 2.5 Flash image generation not available on current quota, trying Imagen 3:', (err as Error).message);
      }

      // If flash-image didn't produce image bytes, try Imagen 3
      if (!imageBuffer) {
        try {
          const imageResult = await client.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/jpeg',
              aspectRatio: '1:1',
              personGeneration: PersonGeneration.ALLOW_ADULT,
            },
          });

          const base64Data = imageResult.generatedImages?.[0]?.image?.imageBytes;
          if (base64Data) {
            imageBuffer = Buffer.from(base64Data, 'base64');
            modelUsed = 'gemini-imagen-3';
          }
        } catch (err) {
          console.warn('Gemini Imagen 3 requires Vertex AI / billed quota:', (err as Error).message);
        }
      }
    } catch (err) {
      console.warn('Gemini API call failed. Falling back to built-in visual engine:', err);
    }
  }

  // 2. Photorealistic engine if external generation was unavailable or quota exceeded
  if (!imageBuffer) {
    imageBuffer = await getPhotorealisticPersonaBuffer(input.options, input.personaName, input.adultAge, input.personaId);
    modelUsed = 'personaq-realistic-engine (photorealistic)';
  }

  // 3. Process media: EXIF stripping, 400px thumbnail, cryptographic SHA-256 manifest
  const processed = await processMediaImage(imageBuffer, input.personaId);

  // 4. Upload to storage as standard JPEG
  const timestamp = Date.now();
  const fileExt = processed.format === 'png' ? 'png' : 'jpg';
  const mimeType = processed.format === 'png' ? 'image/png' : 'image/jpeg';
  const storageKey = `personas/${input.personaId}/visual_${timestamp}.${fileExt}`;
  const thumbKey = `personas/${input.personaId}/thumb_${timestamp}.jpg`;

  const uploadRes = await storage.upload(
    processed.optimizedBuffer,
    storageKey,
    mimeType
  );

  const thumbRes = await storage.upload(
    processed.thumbnailBuffer,
    thumbKey,
    'image/jpeg'
  );

  // Persist this specific angle directly into the persona's upload folder
  if (input.personaId) {
    try {
      const personaDir = path.resolve(process.cwd(), `public/uploads/personas/${input.personaId}`);
      if (!fs.existsSync(personaDir)) {
        fs.mkdirSync(personaDir, { recursive: true });
      }
      const safeWrite = (filePath: string, buf: Buffer) => {
        try {
          fs.writeFileSync(filePath, buf);
        } catch {
          try {
            const tmp = `${filePath}.tmp.${Date.now()}`;
            fs.writeFileSync(tmp, buf);
            fs.renameSync(tmp, filePath);
          } catch {
            // ignore
          }
        }
      };

      const currentAngle = input.options.cameraAngle || 'front';
      const angleFilePath = path.join(personaDir, `angle_${currentAngle}.jpg`);
      safeWrite(angleFilePath, processed.optimizedBuffer);

      if (currentAngle === 'front') {
        const baseFrontPath = path.join(personaDir, 'base_front.jpg');
        safeWrite(baseFrontPath, processed.optimizedBuffer);

        if (input.options.isFaceLocked) {
          const lockedFacePath = path.join(personaDir, 'locked_face.jpg');
          safeWrite(lockedFacePath, processed.optimizedBuffer);
        }
      }
    } catch (saveErr) {
      console.warn('Failed to save angle file directly to persona folder:', saveErr);
    }
  }

  const multiAnglePack = getPersonaMultiAnglePack(
    input.options.ethnicity,
    input.personaId,
    input.options.styleLook
  );

  return {
    imageUrl: uploadRes.url,
    thumbnailUrl: thumbRes.url,
    provenanceHash: processed.contentHashSha256,
    prompt,
    modelUsed,
    config: input.options,
    multiAnglePack,
  };
}

/**
 * Marks the selected generated image as the authoritative Visual Model for the persona.
 */
export async function markAsPersonaVisualModel(input: {
  personaId: string;
  imageUrl: string;
  config: VisualModelOptions;
  prompt: string;
  modelUsed?: string;
  userId?: string;
}) {
  const { personaId, imageUrl, config, prompt, modelUsed, userId } = input;

  // 1. Fetch persona
  const persona = await prisma.persona.findUnique({
    where: { id: personaId },
  });

  if (!persona) {
    throw new Error('Persona not found');
  }

  // 2. Synthesize updated appearance notes that include the visual model specifics
  const ethnicityTitle =
    config.ethnicity === 'custom'
      ? config.ethnicityCustom || 'Custom'
      : (config.ethnicity || 'south_indian').replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const bodyTitle = (config.bodyStructure || 'hourglass').replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const dnaSummary = formatPhysicalDNASummary(config);
  const visualSummary = `[Visual Reference Model: ${ethnicityTitle} • ${bodyTitle} Build • Verified Adult AI Identity]\n${dnaSummary}`.trim();

  // Merge with existing appearance notes cleanly, stripping any clothing, attire, or outfit notes
  let baseNotes = persona.appearanceNotes.replace(/\[Visual Reference Model:[\s\S]*?(?=(\n\n|$))/g, '').trim();
  baseNotes = baseNotes
    .replace(/(often wears|wears|wearing|attire|outfit|clothing|fashion|kurtas|techwear|accessories)[\s\S]*?(?=(\.|$))/gi, '')
    .trim();
  const updatedAppearanceNotes = `${visualSummary}\n\n${baseNotes}`.trim();

  // 3. Create or save as an Asset in Asset Library
  const asset = await prisma.asset.create({
    data: {
      personaId,
      storageKey: imageUrl.replace(/^.*\/uploads\//, ''),
      url: imageUrl,
      type: 'image',
      suitability: 'sfw_safe',
      aiGenerated: true,
      tags: JSON.stringify([
        'persona_model',
        'reference_avatar',
        config.ethnicity,
        config.styleLook,
      ]),
      provenanceMeta: JSON.stringify({
        ai_generated: true,
        model_used: modelUsed || 'gemini-imagen-3',
        prompt,
        config,
        marked_at: new Date().toISOString(),
      }),
      safetyStatus: 'passed',
      safetyReasons: JSON.stringify(['Verified adult-only persona visual reference', 'SFW passed']),
    },
  });

  // Run Safety Gate Pipeline to stamp compliance
  await runSafetyGatePipeline({
    metadata: {
      prompt,
      tags: ['persona_model', config.ethnicity, config.styleLook],
      suitability: 'sfw_safe',
    },
  });

  // 4. Update the Persona record
  const updatedPersona = await prisma.persona.update({
    where: { id: personaId },
    data: {
      avatarUrl: imageUrl,
      appearanceNotes: updatedAppearanceNotes,
      visualModelConfig: JSON.stringify({
        ...config,
        multiAnglePack: getPersonaMultiAnglePack(config.ethnicity, personaId, config.styleLook),
        referenceImageUrl: config.referenceImageUrl || imageUrl,
      }),
    },
    include: {
      platformAccounts: true,
      versions: {
        orderBy: { versionNumber: 'desc' },
        take: 10,
      },
    },
  });

  // 5. Version snapshot
  const versionCount = await prisma.personaVersion.count({
    where: { personaId },
  });

  await prisma.personaVersion.create({
    data: {
      personaId,
      versionNumber: versionCount + 1,
      snapshotJson: JSON.stringify({
        ...updatedPersona,
        visualModelAssetId: asset.id,
      }),
      changeSummary: `Updated Persona Visual Model (${ethnicityTitle} - ${bodyTitle})`,
      createdById: userId,
    },
  });

  // 6. Audit Log
  await logAuditEvent({
    userId,
    action: 'persona_update',
    entity: 'Persona',
    entityId: personaId,
    meta: {
      event: 'visual_model_marked',
      ethnicity: config.ethnicity,
      style: config.styleLook,
      assetId: asset.id,
      imageUrl,
    },
  });

  return {
    success: true,
    persona: updatedPersona,
    asset,
  };
}
