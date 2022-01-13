const fs                = require('fs');
const jsObfuscator      = require('js-obfuscator');
const pretty            = require('pretty');
const prettyjs          = require('pretty-js');

require('log-timestamp');

const folder = './components';
const config = JSON.parse(fs.readFileSync('./config.json'));

const options = {
    keepLinefeeds:      config['obfuscator']['keepLinefeeds'],
    keepIndentations:   config['obfuscator']['keepIndentations'],
    encodeStrings:      config['obfuscator']['encodeStrings'],
    encodeNumbers:      config['obfuscator']['encodeNumbers'],
    moveStrings:        config['obfuscator']['moveStrings'],
    replaceNames:       config['obfuscator']['replaceNames'],
    variableExclusions: ['^_get_', '^_set_', '^_mtd_']
};

const writeFile = async (file, data) => {
    try {
        await fs.promises.writeFile(file, data, 'utf8');
    } catch (e) {
        console.error(e);
    }
}

const deleteFiles = function() {
    fs.readdirSync('./src').forEach(file => {
        if (file.indexOf('.js') > -1) fs.unlink('./src/' + file, (e) => console.error(e));
    });
}

const getTitle = (data) => {
    const title = data.split('\n')[0];
    if (title.indexOf('@') === -1) throw Error('Title is not found.');

    return `document.title = '${title.slice(1)}';`;
}

const getDataFromTag = (data) => {
    data = data.split('\n').slice(1).join('');

    return [
        data.substring(0, data.indexOf('<style>')),
        /<style>(.*?)<\/style>/g.exec(data)[1],
        /<script>(.*?)<\/script>/g.exec(data)[1],
        data.match(/<include(.*?)\/>/g)
    ];
}

const compile = async () => {
    const id = Date.now();
    const files = fs.readdirSync(folder);

    let content = '<!DOCTYPE html><html lang="en" dir="ltr"><head><meta charset="utf-8"><title></title></head><body></body></html>';
    let html = '';
    let css = '';
    let js = '';

    files.forEach(async (file, index) => {
        try {
            const data = fs.readFileSync(`${folder}/${file}`, 'utf8');
            const tags = getDataFromTag(data);
            html += `<div class="${id}" id="${file.split('.')[0]}" style="display: none;">${tags[0]}</div>`;

            files.forEach(file => {
                html = html.replaceAll(`href="#${file.split('.')[0]}"`, `href="#${file.split('.')[0]}" onclick="SB_${file.split('.')[0]}()"`);
                html = html.replaceAll('href="#"', `href="#" onclick="SB_index()"`);
            });

            css += (tags[1]) ? `<style>${tags[1]}</style>` : '';

            js += `
                    function SB_${file.split('.')[0]}() {
                            ${tags[2]}
                            ${getTitle(data)}
                            for (const element of document.getElementsByClassName('${id}'))
                                    element.style.display = 'none';
                            document.getElementById('${file.split('.')[0]}').style.display = 'block';
                    }
            `;

            tags[3]?.map(link => {
                html += `<script${
                    /<include(.*?)\/>/g.exec(link)[1]
                }></script>`;
            });

            if (file == "index.jvb") js += `if (document.URL.indexOf('#${file.split('.')[0]}') > -1 || document.URL[document.URL.length - 1] == '#' || document.URL.indexOf('#') == -1) SB_${file.split('.')[0]}();`;
            else js += `if (document.URL.indexOf('#${file.split('.')[0]}') > -1) SB_${file.split('.')[0]}();`;

            console.log("\033[1;32m[Start]\033[0m " + file);
        } catch (e) {
            console.error(e);
        }
    });
    deleteFiles();
    content = content.replace('</head>', `${css}</head>`);
    content = content.replace('</body>', `${html}<script src="${id}.js"></script></body>`);

    writeFile('./src/index.html', pretty(content));
    writeFile(`./src/${id}.js`, (config['encode']) ? prettyjs(await jsObfuscator(js, options)) : js);
}

compile();
fs.readdirSync(folder).forEach(file => {
    fs.watchFile(folder + "/" + file, (curr, prev) => {
        console.log("\033[1;32m[Restart]\033[0m");
        compile();
    })
});
