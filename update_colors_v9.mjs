import fs from 'fs';
import path from 'path';

// Define the directory to search
const srcDir = path.resolve('src');

// Function to recursively find all relevant files
function findFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            findFiles(filePath, fileList);
        } else if (file.endsWith('.css') || file.endsWith('.tsx') || file.endsWith('.ts')) {
            fileList.push(filePath);
        }
    }

    return fileList;
}

// Function to replace colors in a file
function replaceColors(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    // Emerald Green replacements -> Cyber Cyan (#00F0FF)
    content = content.replace(/#10[bB]981/g, '#00F0FF');
    content = content.replace(/#10b981/g, '#00F0FF');
    // Replace rgba variants of emerald green (16, 185, 129)
    // with rgba variants of cyan (0, 240, 255)
    content = content.replace(/rgba\(\s*16\s*,\s*185\s*,\s*129\s*,/g, 'rgba(0, 240, 255,');

    // Cyan replacements -> Electric Purple (#8A2BE2) 
    // Wait, let's keep secondary elements magenta/purple. `#06b6d4` was secondary.
    content = content.replace(/#06[bB]6[dD]4/g, '#8A2BE2');
    content = content.replace(/rgba\(\s*6\s*,\s*182\s*,\s*212\s*,/g, 'rgba(138, 43, 226,');

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated: ${filePath}`);
    }
}

// Execute
console.log('Starting global color replacement for Spatial UI (Cyber Cyan & Electric Purple)...');
const allFiles = findFiles(srcDir);
for (const file of allFiles) {
    replaceColors(file);
}
console.log('Replacement complete.');
