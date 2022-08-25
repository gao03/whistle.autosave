const fs = require('fs');
const path = require('path');
const md5 = require('md5');
const { check: checkFilter, update: updateFilter } = require('./filter');

const MAX_LENGTH = 10;
const noop = () => { };

module.exports = (server, { storage }) => {
  let sessions = [];
  let timer;
  const writeSessions = (dir) => {
    try {
      const text = JSON.stringify(sessions.slice(), null, '  ');
      sessions = [];
      dir = path.resolve(dir, `${Date.now()}.txt`);
      fs.writeFile(dir, text, (err) => {
        if (err) {
          fs.writeFile(dir, text, noop);
        }
      });
    } catch (e) { }
  };
  const checkAndSaveImage = (s, dir) => {
    try {
      const contentType = s['res']['headers']['content-type']
      const url = s['url']
      const reqTime = s['requestTime']
      const body = s['res']['base64']
      if (! contentType || !contentType.startsWith('image/') || !url || !body)  {
        return
      }
      var buffer = Buffer.from(body, 'base64')
      
      const fileType = contentType.split('/')[1].split('+')[0].split(';')[0]
      let filename = reqTime + '-' + md5(url) + "." + fileType
      filename = path.resolve(dir, 'image', filename) 
      fs.createWriteStream(filename).write(buffer);
      s['res']['localFileName'] = filename
    } catch  (e) {
      console.log('save image error', e)
    }
  }
  updateFilter(storage.getProperty('filterText'));
  server.on('request', (req) => {
    // filter
    const active = storage.getProperty('active');
    if (!active) {
      return;
    }
    const dir = storage.getProperty('sessionsDir');
    if (!dir || typeof dir !== 'string') {
      sessions = [];
      return;
    }
    if (!checkFilter(req.originalReq.url)) {
      return;
    }
    req.getSession((s) => {
      if (!s) {
        return;
      }
      checkAndSaveImage(s, dir)
      console.log(s['res']['localFileName'] )
      clearTimeout(timer);
      sessions.push(s);
      if (sessions.length >= MAX_LENGTH) {
        writeSessions(dir);
      } else {
        // 10秒之内没满10条强制写入
        timer = setTimeout(() => writeSessions(dir), 10000);
      }
    });
  });
};
