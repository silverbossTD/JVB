import fs from 'fs';
import jsObfuscator from 'js-obfuscator';
import pretty from 'pretty';
import prettyjs from 'pretty-js';
import uglifyjs from 'uglify-js';
import logTimestamp from 'log-timestamp';

import { logger, uniqueID } from './utils.js';

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
  /**
   * Remove all js files.
   * @constructor
   * @returns {} Nothing is returned.
   */
  static deleteFiles() {
    fs.readdirSync('./src').map(file => {
      if (file.includes('.js'))
        fs.unlink('./src/' + file, (e) => console.error(e));
    });
  }

  /**
   * Get the title from the file.
   * @constructor
   * @param {string} file - The name of the file.
   * @param {string} data - The code of the jvb file.
   * @returns {string} A javascript code to change the title.
   */
  static getTitle(file, data) {
    try {
      const title = new RegExp('@(.*?)\n').exec(data)[1];
      return `document.title = '${title}'`;
    } catch (e) {
      logger.warn('[WARN]', 'Title is not found in ' + file);
      return `document.title = '${file.split('.')[0]}'`;
    }
  }

  /**
   * Get data from tags.
   * @constructor
   * @param {string} data - The code of the jvb file.
   * @returns {array} An array containing html, css, js code and link scripts after being processed.
   */
  static getDataFromTags(data) {
    data = data
            .replace(new RegExp('@(.*?)\n'), '')
            .replace(new RegExp('\n', 'g'), '');

    return [
      data.substring(0, data.indexOf('<style>')),
      new RegExp('<style>(.*?)<\/style>', 'g').exec(data)[1],
      new RegExp('<script>(.*?)<\/script>', 'g').exec(data)[1].replace(new RegExp('#include(.*?);', 'g'), ''),
      data.match(new RegExp('#include(.*?);', 'g'))
    ];
  }

  /**
   * Write the data to file.
   * @constructor
   * @param {string} file - The name of the file.
   * @param {string} data - The code of the jvb file.
   * @returns {} Nothing is returned.
   */
  static async writeFile(file, data) {
    try {
      await fs.promises.writeFile(file, data, 'utf8');
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * Code processing.
   * @constructor
   * @returns {} Nothing is returned.
   */
  static async compile() {
    const id = uniqueID();
    const files = fs.readdirSync(folder);

    let content = config['html-default'];
    let css = '';
    let js = '';
    let scripts = '';

    files.map((file, index) => {
      const data = fs.readFileSync(`${folder}/${file}`, 'utf8');
      const tags = this.getDataFromTags(data);
      let html = `<div class="${id}" id="${file.split('.')[0]}">${tags[0]}</div>`;

      files.map(file => {
        html = html.replace(new RegExp(`href="#${file.split('.')[0]}"`, 'g'), `href="#${file.split('.')[0]}" onclick="JVB_${file.split('.')[0]}()"`);
        html = html.replace(new RegExp('href="#"', 'g'), 'href="#" onclick="JVB_index()"');
      });

      css += (tags[1]) ? `<style>${tags[1]}</style>` : '';

      js += `function JVB_${file.split('.')[0]}() {\n document.getElementsByTagName('body')[0].innerHTML = '${html}';\n ${tags[2]}\n ${this.getTitle(file, data)} \n}`;

      tags[3]?.map(link => {
        scripts += `<script src=${new RegExp('#include(.*?);', 'g').exec(link)[1]}></script>`;
      });

      if (file === "index.jvb") js += `if (document.URL.includes('#${file.split('.')[0]}') || document.URL[document.URL.length - 1] === '#' || !document.URL.includes('#')) JVB_${file.split('.')[0]}();`;
      else js += `if (document.URL.includes('#${file.split('.')[0]}')) JVB_${file.split('.')[0]}();`;

      logger.success("[START] ", file);
    });
    content = content.replace('</head>', `${css}</head>`);
    content = content.replace('</body>', `${scripts}<script src="app.${id}.js"></script></body>`);

    this.deleteFiles();
    this.writeFile('./src/index.html', pretty(content));
    this.writeFile(`./src/app.${id}.js`, (config['encode']) ? await jsObfuscator(uglifyjs.minify(js).code, options) : js);
  }

  /**
   * Start.
   * @constructor
   * @returns {} Nothing is returned.
   */
  static async run() {
    this.compile();
    fs.readdirSync(folder).map(file => {
      fs.watchFile(folder + "/" + file, (curr, prev) => {
        logger.success("[RESTART]");
        this.compile();
      })
    });
  }
}

JVB.run();
