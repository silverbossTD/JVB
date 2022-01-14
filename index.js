const fs                = require('fs');
const jsObfuscator      = require('js-obfuscator');
const pretty            = require('pretty');
const prettyjs          = require('pretty-js');
const { Logger }        = require('./utils');
const UglifyJS          = require('uglify-js');

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

class JVB {
    static deleteFiles() {
        fs.readdirSync('./src').forEach(file => {
            if (file.indexOf('.js') > -1)
                fs.unlink('./src/' + file, (e) => console.error(e));
        });
    }

    static getTitle(data) {
        const title = data.split('\n')[0];
        if (title.indexOf('@') == -1) throw Error('Title is not found.');

        return `document.title = '${title.slice(1)}';`;
    }

    static getDataFromTags(data) {
        data = data.split('\n').slice(1).join('');

        return [
            data.substring(0, data.indexOf('<style>')),
            /<style>(.*?)<\/style>/g.exec(data)[1],
            /<script>(.*?)<\/script>/g.exec(data)[1],
            data.match(/<include(.*?)\/>/g)
        ];
    }

    static async writeFile(file, data) {
        try {
            await fs.promises.writeFile(file, data, 'utf8');
        } catch (e) {
            console.error(e);
        }
    }

    static async compile() {
        const id = Date.now();
        const files = fs.readdirSync(folder);

        let content = '<!DOCTYPE html><html lang="en" dir="ltr"><head><meta charset="utf-8"><title></title></head><body></body></html>';
        let html = '';
        let css = '';
        let js = '';
        let scripts = '';

        files.forEach(async (file, index) => {
            const data = fs.readFileSync(`${folder}/${file}`, 'utf8');
            const tags = this.getDataFromTags(data);
            html += `<div class="${id}" id="${file.split('.')[0]}" style="display: none;">${tags[0]}</div>`;

            files.forEach(file => {
                html = html.replaceAll(`href="#${file.split('.')[0]}"`, `href="#${file.split('.')[0]}" onclick="JVB_${file.split('.')[0]}()"`);
                html = html.replaceAll('href="#"', `href="#" onclick="JVB_index()"`);
            });

            css += (tags[1]) ? `<style>${tags[1]}</style>` : '';

            js += `
                    function JVB_${file.split('.')[0]}() {
                            ${tags[2]}
                            ${this.getTitle(data)}
                            for (const element of document.getElementsByClassName('${id}'))
                                    element.style.display = 'none';
                            document.getElementById('${file.split('.')[0]}').style.display = 'block';
                    }
            `;

            tags[3]?.map(link => {
                scripts += `<script${
                    /<include(.*?)\/>/g.exec(link)[1]
                }></script>`;
            });

            if (file == "index.jvb") js += `if (document.URL.indexOf('#${file.split('.')[0]}') > -1 || document.URL[document.URL.length - 1] == '#' || document.URL.indexOf('#') == -1) JVB_${file.split('.')[0]}();`;
            else js += `if (document.URL.indexOf('#${file.split('.')[0]}') > -1) JVB_${file.split('.')[0]}();`;

            Logger.success("[START] ", file);
        });
        content = content.replace('</head>', `${css}</head>`);
        content = content.replace('</body>', `${scripts}<script src="app.${id}.js"></script></body>`);

        this.deleteFiles();
        this.writeFile('./src/index.html', pretty(content));
        this.writeFile(`./src/app.${id}.js`, (config['encode']) ? (`document.write('${html}');\n`+ await jsObfuscator(UglifyJS.minify(js).code, options)) : js);
    }

    static async run() {
        this.compile();
        fs.readdirSync(folder).forEach(file => {
            fs.watchFile(folder + "/" + file, (curr, prev) => {
                Logger.success("[RESTART]");
                this.compile();
            })
        });
    }
}

JVB.run();
