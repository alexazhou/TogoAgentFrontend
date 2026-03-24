import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.resolve(__dirname, '../public/avatars');
const avatarCount = 100;
const gridSize = 5;
const cellSize = 14;
const padding = 10;
const canvasSize = padding * 2 + gridSize * cellSize;

function writeDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function createSvg(index) {
  const hue = (index * 37 + 196) % 360;
  const background = `hsl(${hue} 42% 84%)`;
  const foreground = `hsl(${hue} 58% 30%)`;
  const border = `hsl(${hue} 36% 68%)`;
  let state = (index + 1) * 2654435761 >>> 0;
  let rects = '';

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < Math.ceil(gridSize / 2); x += 1) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      const filled = (state >>> 0) & 1;
      if (!filled) {
        continue;
      }

      const leftX = padding + x * cellSize;
      const rightX = padding + (gridSize - 1 - x) * cellSize;
      const yPos = padding + y * cellSize;
      rects += `<rect x='${leftX}' y='${yPos}' width='${cellSize}' height='${cellSize}' rx='2' fill='${foreground}'/>`;
      if (rightX !== leftX) {
        rects += `<rect x='${rightX}' y='${yPos}' width='${cellSize}' height='${cellSize}' rx='2' fill='${foreground}'/>`;
      }
    }
  }

  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${canvasSize} ${canvasSize}' width='${canvasSize}' height='${canvasSize}' role='img' aria-label='agent avatar ${index + 1}'><rect width='${canvasSize}' height='${canvasSize}' rx='18' fill='${background}'/><rect x='6' y='6' width='${canvasSize - 12}' height='${canvasSize - 12}' rx='14' fill='none' stroke='${border}'/>${rects}</svg>`;
}

writeDir(outputDir);

for (let i = 0; i < avatarCount; i += 1) {
  const fileName = `${String(i + 1).padStart(3, '0')}.svg`;
  fs.writeFileSync(path.join(outputDir, fileName), createSvg(i));
}

console.log(`generated ${avatarCount} avatars in ${outputDir}`);
