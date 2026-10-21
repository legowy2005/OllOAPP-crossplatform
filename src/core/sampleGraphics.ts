/**
 * Built-in sample vector graphics generator for the OllO Image Editor.
 * Creates sharp, text-and-diagram canvases to test 1-bit, 2-bit grayscale,
 * Sauvola adaptive thresholding, dithering, and RGB565 modes.
 */

export interface SampleGraphic {
  id: string;
  name: string;
  description: string;
  generate: () => HTMLCanvasElement;
}

export const SAMPLE_GRAPHICS: SampleGraphic[] = [
  {
    id: 'kanji_study',
    name: 'Kanji "学" (Study) with Strokes',
    description: 'High-contrast character strokes and stroke order diagram',
    generate: () => {
      const c = document.createElement('canvas');
      c.width = 640;
      c.height = 400;
      const ctx = c.getContext('2d')!;

      // Background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, c.width, c.height);

      // Border frame
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, c.width - 20, c.height - 20);

      // Large Kanji
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 150px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('学', 200, 200);

      // Stroke order & annotations
      ctx.textAlign = 'left';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('KANJI: GAKU / MANABU', 360, 90);

      ctx.font = 'normal 22px sans-serif';
      ctx.fillStyle = '#444444';
      ctx.fillText('Meaning: Study, Learning, School', 360, 130);
      ctx.fillText('Strokes: 8', 360, 170);
      ctx.fillText('Radical: 子 (Child)', 360, 210);

      // Stroke guide boxes
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#777777';
      for (let i = 0; i < 4; i++) {
        const bx = 360 + i * 65;
        const by = 260;
        ctx.strokeRect(bx, by, 55, 55);
        ctx.fillStyle = '#111111';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`① +${i}`, bx + 27, by + 35);
      }

      ctx.fillStyle = '#666666';
      ctx.font = 'italic 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('OllO Smart Glasses Test Deck · 640x400 Micro-OLED', 320, 370);

      return c;
    },
  },
  {
    id: 'heart_anatomy',
    name: 'Medical: Cardiac Anatomy',
    description: 'Diagram of cardiac chambers, valves, and blood flow paths',
    generate: () => {
      const c = document.createElement('canvas');
      c.width = 640;
      c.height = 400;
      const ctx = c.getContext('2d')!;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, c.width, c.height);

      ctx.strokeStyle = '#222222';
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 8, c.width - 16, c.height - 16);

      // Title
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('INTERNAL CARDIAC STRUCTURE', 320, 48);

      // Schematic Heart Chambers
      const cx = 320;
      const cy = 210;

      // Outer heart border
      ctx.beginPath();
      ctx.ellipse(cx, cy, 140, 120, 0, 0, Math.PI * 2);
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#111111';
      ctx.stroke();

      // Septum divider vertical
      ctx.beginPath();
      ctx.moveTo(cx, cy - 120);
      ctx.lineTo(cx, cy + 120);
      ctx.lineWidth = 4;
      ctx.stroke();

      // Valve divider horizontal
      ctx.beginPath();
      ctx.moveTo(cx - 140, cy - 20);
      ctx.lineTo(cx + 140, cy - 20);
      ctx.lineWidth = 3;
      ctx.stroke();

      // Labels
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#111111';
      ctx.fillText('RA', cx - 60, cy - 60);
      ctx.fillText('LA', cx + 60, cy - 60);
      ctx.fillText('RV', cx - 60, cy + 50);
      ctx.fillText('LV', cx + 60, cy + 50);

      // Legend
      ctx.font = 'normal 17px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('• RA: Right Atrium (deox)', 30, 110);
      ctx.fillText('• RV: Right Ventricle', 30, 145);
      ctx.fillText('• Tricuspid Valve', 30, 180);

      ctx.textAlign = 'right';
      ctx.fillText('LA: Left Atrium (ox) •', 610, 110);
      ctx.fillText('LV: Left Ventricle (high P) •', 610, 145);
      ctx.fillText('Mitral / Bicuspid Valve •', 610, 180);

      ctx.textAlign = 'center';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('Aortic Valve → Systemic Circulation (120/80 mmHg)', 320, 360);

      return c;
    },
  },
  {
    id: 'cpu_pipeline',
    name: 'Computer Arch: 5-Stage Pipeline',
    description: 'Classic RISC instruction execution pipeline diagram',
    generate: () => {
      const c = document.createElement('canvas');
      c.width = 640;
      c.height = 400;
      const ctx = c.getContext('2d')!;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, c.width, c.height);

      ctx.strokeStyle = '#222222';
      ctx.lineWidth = 3;
      ctx.strokeRect(10, 10, c.width - 20, c.height - 20);

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CLASSIC 5-STAGE RISC PIPELINE', 320, 50);

      const stages = [
        { name: 'IF', full: 'Instruction\nFetch', color: '#E0E0E0' },
        { name: 'ID', full: 'Instruction\nDecode', color: '#D0D0D0' },
        { name: 'EX', full: 'Execute /\nALU Ops', color: '#C0C0C0' },
        { name: 'MEM', full: 'Memory\nAccess', color: '#B0B0B0' },
        { name: 'WB', full: 'Write\nBack', color: '#A0A0A0' },
      ];

      const startX = 40;
      const boxW = 95;
      const boxH = 120;
      const gap = 24;
      const y = 110;

      stages.forEach((stage, i) => {
        const x = startX + i * (boxW + gap);
        ctx.fillStyle = stage.color;
        ctx.fillRect(x, y, boxW, boxH);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, boxW, boxH);

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 26px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(stage.name, x + boxW / 2, y + 45);

        ctx.font = 'normal 13px sans-serif';
        const lines = stage.full.split('\n');
        lines.forEach((line, lineIdx) => {
          ctx.fillText(line, x + boxW / 2, y + 75 + lineIdx * 18);
        });

        // Arrow to next stage
        if (i < stages.length - 1) {
          const arrowX = x + boxW + 4;
          const arrowY = y + boxH / 2;
          ctx.beginPath();
          ctx.moveTo(arrowX, arrowY);
          ctx.lineTo(arrowX + 16, arrowY);
          ctx.lineTo(arrowX + 11, arrowY - 6);
          ctx.moveTo(arrowX + 16, arrowY);
          ctx.lineTo(arrowX + 11, arrowY + 6);
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#000000';
          ctx.stroke();
        }
      });

      // Hazard notes
      ctx.textAlign = 'left';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('Pipeline Hazards:', 40, 275);
      ctx.font = 'normal 15px sans-serif';
      ctx.fillText('1. Structural: Hardware resource conflicts', 40, 305);
      ctx.fillText('2. Data: RAW, WAR, WAW dependencies (Forwarding unit mitigates)', 40, 330);
      ctx.fillText('3. Control: Branch penalties (Branch predictor minimizes bubbles)', 40, 355);

      return c;
    },
  },
  {
    id: 'book_passage',
    name: 'Book Page (Sauvola Benchmark)',
    description: 'Dense printed typography paragraph for testing adaptive thresholding',
    generate: () => {
      const c = document.createElement('canvas');
      c.width = 640;
      c.height = 400;
      const ctx = c.getContext('2d')!;

      // Add slight gradient / paper vignette to test Sauvola vs global thresholding
      const grad = ctx.createLinearGradient(0, 0, c.width, c.height);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.5, '#F5F5F0');
      grad.addColorStop(1, '#D8D8D0');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, c.width, c.height);

      ctx.fillStyle = '#111111';
      ctx.font = 'bold 22px serif';
      ctx.textAlign = 'left';
      ctx.fillText('CHAPTER IV: THE OPTICAL WAVEGUIDE', 40, 45);

      ctx.font = 'normal 16px serif';
      const textLines = [
        'Miniaturized heads-up displays rely on diffractive surface-relief gratings to couple',
        'collimated light into a thin high-index glass substrate. Within the waveguide, the',
        'light experiences total internal reflection (TIR) until encountering an extraction',
        'grating that expands the exit pupil along both axes.',
        '',
        'Because ambient illumination varies by several orders of magnitude between direct',
        'sunlight (up to 100,000 lux) and dim indoor environments (100 lux), high-efficiency',
        'micro-OLED emitters and high-contrast 1-bit or 2-bit quantization algorithms are',
        'essential to preserve edge fidelity without overwhelming the peripheral vision.',
        '',
        'The OllO firmware implements sub-millisecond chunked transport over BLE 5.0 to',
        'render complex equations and medical illustrations with zero artifact tearing.',
      ];

      let curY = 85;
      textLines.forEach((line) => {
        if (line === '') {
          curY += 12;
        } else {
          ctx.fillText(line, 40, curY);
          curY += 24;
        }
      });

      return c;
    },
  },
];
