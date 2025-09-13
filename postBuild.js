// take the template index.html, copy to build folder, and inject the script tag for the bundled js file
import fs from 'fs';
import path from 'path';

function postBuild() {
    const templatePath = path.resolve('./src', 'index.html');
    const htmlContent = fs.readFileSync(templatePath, 'utf-8');

    const scriptPath = path.resolve('./build', 'index.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');

    const scriptTag = `<script type="module">\n${scriptContent}\n</script>\n`;
    const outputPath = path.resolve('./build', 'index.html');

    // delete the old index.html if exists
    if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
    }

    fs.writeFileSync(outputPath, htmlContent.replace('</body>', `${scriptTag}</body>`));

    fs.unlinkSync(scriptPath); // remove the separate js file
}

postBuild();
