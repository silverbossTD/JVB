const LCERROR = '\x1b[1;31m%s\x1b[0m'; //red
const LCWARN = '\x1b[1;33m%s\x1b[0m'; //yellow
const LCINFO = '\x1b[1;36m%s\x1b[0m'; //cyan
const LCSUCCESS = '\x1b[1;32m%s\x1b[0m'; //green

export class logger {
    static error(message, ...optionalParams) {
      console.error(LCERROR, message, ...optionalParams)
    }
    static warn(message, ...optionalParams) {
      console.warn(LCWARN, message, ...optionalParams)
    }
    static info(message, ...optionalParams) {
      console.info(LCINFO, message, ...optionalParams)
    }
    static success(message, ...optionalParams) {
      console.info(LCSUCCESS, message, ...optionalParams)
    }
}

/**
 * Generator unique ID.
 * @constructor
 * @returns {string} Unique ID.
 */
export function uniqueID() {
  return Math.random().toString(36).substring(2) +
    (new Date()).getTime().toString(36);
}
