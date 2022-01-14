import fs from 'fs';
import jsObfuscator from 'js-obfuscator';
import pretty from 'pretty';
import prettyjs from 'pretty-js';
import uglifyJS from 'uglify-js';
import logTimestamp from 'log-timestamp';

import { logger, generateID } from './utils.js';

const folder = './components';
const config = JSON.parse(fs.readFileSync('./config.json'));

const options = {
  keepLinefeeds: config['obfuscator']['keepLinefeeds'],
  keepIndentations: config['obfuscator']['keepIndentations'],
  encodeStrings: config['obfuscator']['encodeStrings'],
  encodeNumbers: config['obfuscator']['encodeNumbers'],
  moveStrings: config['obfuscator']['moveStrings'],
  replaceNames: config['obfuscator']['replaceNames'],
  variableExclusions: ['^_get_', '^_set_', '^_mtd_']
};

logTimestamp(() => '%s');

class JVB {
  static deleteFiles() {
    fs.readdirSync('./src').forEach(file => {
      if (file.indexOf('.js') > -1)
        fs.unlink('./src/' + file, (e) => console.error(e));
    });
  }

  static getTitle(file, data) {
    let title = data.split('\n')[0];
    if (title.indexOf('@') == -1) {
      logger.warn('[WARN]  ', `Title not found in ${file}`);
      title = '@' + file.split('.')[0];
    }

    return `document.title = '${title.slice(1)}';`;
  }

  static getDataFromTags(data) {
    if (data[0] == '@')
      data = data.split('\n').slice(1).join('');
    else
      data = data.replaceAll('\n', '');

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
    const id = generateID();
    const files = fs.readdirSync(folder);

    let content = config['html-default'];
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
                            ${this.getTitle(file, data)}
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

      logger.success("[START] ", file);
    });
    content = content.replace('</head>', `${css}</head>`);
    content = content.replace('</body>', `${scripts}<script src="app.${id}.js"></script></body>`);

    this.deleteFiles();
    this.writeFile('./src/index.html', pretty(content));
    this.writeFile(`./src/app.${id}.js`, (config['encode']) ? (`document.write('${html}');\n` + await jsObfuscator(uglifyJS.minify(js).code, options)) : js);
  }

  static async run() {
    this.compile();
    fs.readdirSync(folder).forEach(file => {
      fs.watchFile(folder + "/" + file, (curr, prev) => {
        logger.success("[RESTART]");
        this.compile();
      })
    });
  }
}

JVB.run();
