const fs = require( 'fs' );
const io = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('logger');
const spdy = require('spdy');
const ip = require('obtener_ip');
const cfg = require('configuracion');

const key = fs.readFileSync(`${cfg.directorio}/${cfg.certificado.ruta}/${cfg.certificado.nombre}.key`);
const cert = fs.readFileSync(`${cfg.directorio}/${cfg.certificado.ruta}/${cfg.certificado.nombre}.crt`);

let app = spdy.createServer({
  key: key,
  cert: cert
});

let socket = io(app);

socket.use((socket, siguiente) => {
  if(socket.handshake.query.auth_token.split(' ')[0] == 'Bearer' && socket.handshake.query.auth_token.split(' ')[1] != '') {
    jwt.verify(socket.handshake.query.auth_token.split(' ')[1], cert, {
      algorithms: [cfg.jwt.algoritmo]
    }, (err, decodificado) => {
      if(err) {
        logger.error(JSON.stringify(err, null, 2));
      }
      else {
        logger.verbose(`Usuario ${decodificado.usuario} autorizado`);
        siguiente();
      }
    });
  }
  else {
    logger.error({
      error: 'No se ha provisto de un token'
    });
  };
});

socket.on('connection', (socket) => {
  logger.info(`Usuario conectado ${socket.id}`);

  socket.on('disconnect', () => {
    logger.info(`Usuario desconectado ${socket.id}`);
  });
});


process.on('message', (interrupcion) => {
  socket.emit(interrupcion.canal, interrupcion.mensaje);
});

app.listen(cfg.socket.puerto, (error) => {
  if(error) {
    logger.error(error);
    return process.exit(1);
  }
  else {
    logger.info(`Servidor iniciado en wss://${ip.obtenerIP()}:${cfg.socket.puerto}`);
  };
});
