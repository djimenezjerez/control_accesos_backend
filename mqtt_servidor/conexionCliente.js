const logger = require('logger');
const modelos = require('modelos_control_accesos');
const ClienteMqtt = modelos.ClienteMqtt;

module.exports = {};

/**
 * @api {get} conexionClientes Cliente conectado al servidor MQTT
 * @apiVersion 2.0.0
 * @apiGroup ConexionClientes
 * @apiSuccess {Boolean} error 1 para definir error, 0 para definir correcto
 * @apiSuccess {String} mensaje Mensaje de notificación
 * @apiSuccess {Boolean} conectado 1 para indicar conectado, 0 para indicar desconectado
 * @apiSuccess {Number} cliente ID del cliente conectado
 * @apiSuccessExample {json} Success
 *    HTTP/2.0 200 OK
 *    {
 *      "error": false,
 *      "mensaje": "Cliente conectado: arduino1",
 *      "conectado": true,
 *      "cliente": 2
 *    }
 */

let registrarConectado = (cliente) => {
  ClienteMqtt.update({
    conectado: true
  }, {
    where: {
      usuario: cliente.id
    }
  })
  .then((resultado) => {
    switch(resultado[0]) {
      case 0:
        global.socket.send({
          canal: 'conexionClientes',
          mensaje: {
            error: false,
            mensaje: `Cliente ${cliente.id} inexistente`
          }
        });
        logger.error(`Cliente ${cliente.id} inexistente`);
        break;
      case 1:
        global.socket.send({
          canal: 'conexionClientes',
          mensaje: {
            error: false,
            mensaje: `Cliente conectado: ${cliente.id}`,
            conectado: true,
            cliente: resultado[0]
          }
        });
        logger.info(`Cliente conectado: ${cliente.id}`);
        break
      default:
        global.socket.send({
          canal: 'conexionClientes',
          mensaje: {
            error: true,
            mensaje: `Error actualizando ${cliente.id}`
          }
        });
        logger.error(`Error actualizando ${cliente.id}`);
    }
  })
  .catch((error) => {
    logger.error(error);
  });
};

let registrarDesconectado = (cliente) => {
  ClienteMqtt.update({
    conectado: false
  }, {
    where: {
      usuario: cliente.id
    }
  })
  .then((resultado) => {
    switch(resultado[0]) {
      case 0:
        global.socket.send({
          canal: 'conexionClientes',
          mensaje: {
            error: true,
            mensaje: `Cliente ${cliente.id} inexistente`
          }
        });
        logger.error(`Cliente ${cliente.id} inexistente`);
        break;
      case 1:
        global.socket.send({
          canal: 'conexionClientes',
          mensaje: {
            error: false,
            mensaje: `Cliente desconectado: ${cliente.id}`,
            conectado: false,
            cliente: resultado[0]
          }
        });
        logger.info(`Cliente desconectado: ${cliente.id}`);
        break
      default:
        global.socket.send({
          canal: 'conexionClientes',
          mensaje: {
            error: true,
            mensaje: `Error actualizando ${cliente.id}`
          }
        });
        logger.error(`Error actualizando ${cliente.id}`);
    }
  })
  .catch((error) => {
    logger.error(error);
  });
};

module.exports.registrarConectado = registrarConectado;
module.exports.registrarDesconectado = registrarDesconectado;
