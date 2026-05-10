const fs = require('fs');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.jsx') || file.endsWith('.js')) { 
            results.push(file);
        }
    });
    return results;
}

const files = walk('./frontend/src');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes(".replace('INC-', '')")) {
        content = content.replace(/\.replace\('INC-', ''\)/g, '');
        fs.writeFileSync(file, content);
        console.log('Fixed', file);
    }
});
