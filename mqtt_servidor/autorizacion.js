const _ = require('lodash');
const mqttRegexBuilder = require('mqtt-regex-builder');
const logger = require('logger');
const hasher = require('hasher');
const modelos = require('modelos_control_accesos');
const Sequelize = modelos.Sequelize;
const ClienteMqtt = modelos.ClienteMqtt;
const Topico = modelos.Topico;
const ClienteTopicoPermiso = modelos.ClienteTopicoPermiso;

module.exports = {};

let buscarTopico = (cliente, topico, tipo) => {
  return new Promise((resolver, rechazar) => {
    return ClienteMqtt.findOne({
      where: {
        usuario: cliente.id
      },
      attributes: ['admin']
    })
    .then((res) => {
      if(res.admin) {
        return resolver(topico);
      }
      else {
        return ClienteTopicoPermiso.findAll({
          where: {
            permiso: tipo
          },
          attributes: [],
          include: [
            {
              model: ClienteMqtt,
              attributes: [],
              where: {
                usuario: cliente.id
              }
            }, {
              model: Topico,
              attributes: ['nombre']
            }
          ]
        })
        .then((clientes) => {
          let resultado = _.filter(clientes, (cliente) => {
            let regex = mqttRegexBuilder(cliente.Topico.nombre);
            return regex.exec(topico) != null || cliente.Topico.nombre == topico;
          });
          if(resultado.length == 1) {
            return resolver(topico);
          }
          else {
            return rechazar(`Cliente ${cliente.id} no tiene permiso de ${tipo} en ${topico}`);
          };
        })
        .catch((error) => {
          return rechazar(error);
        });
      };
    })
    .catch((error) => {
      return rechazar(error);
    });
  });
};

/**
 * @api {get} autorizacionClientes Cliente autorizado para conectarse al servidor MQTT
 * @apiVersion 2.0.0
 * @apiGroup Autorizacion
 * @apiSuccess {Boolean} error 1 para definir error, 0 para definir correcto
 * @apiSuccess {String} mensaje Mensaje de estado de conexión
 * @apiSuccess {Object} cliente Cliente autorizado para conectarse al servidor MQTT
 * @apiSuccessExample {json} Success
 *    HTTP/2.0 200 OK
 *   {
 *     "error": false,
 *     "mensaje": "Conexión autorizada: arduino1",
 *     "cliente": {
 *       "id": 1,
 *       "usuario": "arduino1",
 *       "conectado": false,
 *       "admin": false,
 *       "createdAt": "2017-01-01T01:00:00.000Z",
 *       "updatedAt": "2017-01-01T01:00:00.000Z"
 *     }
 *   }
 */

let autenticar = (cliente, usuario, clave, callback) => {
  if(global.conectado && global.iniciado) {
    ClienteMqtt.findOne({
      where: {
        usuario: usuario,
        conectado: false
      },
    })
    .then((resultado) => {
      if(clave && resultado != null) {
        hasher.verificarHash(clave.toString(), resultado.clave)
        .then((verificado) => {
          if(verificado) {
            if(verificado) {
              global.socket.send({
                canal: 'autorizacionClientes',
                mensaje: {
                  error: false,
                  mensaje: `Conexión autorizada: ${usuario}`,
                  cliente: _.omit(resultado.toJSON(), 'clave')
                }
              });
              logger.info(`Conexión autorizada: ${usuario}`);
              cliente.usuario = usuario;
            }
            else {
              global.socket.send({
                canal: 'autorizacionClientes',
                mensaje: {
                  error: true,
                  mensaje: `Conexión no autorizada: ${usuario}`,
                  cliente: _.omit(resultado.toJSON(), 'clave')
                }
              });
              logger.info(`Conexión no autorizada: ${usuario}`);
            }
            callback(null, verificado);
          }
          else {
            global.socket.send({
              canal: 'autorizacionClientes',
              mensaje: {
                error: true,
                mensaje: `Contraseña inválida para ${usuario}`,
                cliente: _.omit(resultado.toJSON(), 'clave')
              }
            });
            logger.error(`Contraseña inválida para ${usuario}`);
            callback(null, false);
          }
        })
        .catch((error) => {
          logger.error(error);
          callback(null, false);
        });
      }
      else {
        global.socket.send({
          canal: 'autorizacionClientes',
          mensaje: {
            error: true,
            mensaje: `Usuario ${usuario} no registrado`
          }
        });
        logger.error(`Usuario ${usuario} no registrado`);
        callback(null, false);
      }
    })
    .catch((error) => {
      logger.error(error);
      process.exit(1);
    });
  }
};

let publicacion = (cliente, topico, mensaje, callback) => {
  buscarTopico(cliente, topico, 'publicacion')
  .then((res) => {
    callback(null, true);
  })
  .catch((error) => {
    logger.error(error);
    callback(null, false);
  });
};

let suscripcion = (cliente, topico, callback) => {
  buscarTopico(cliente, topico, 'suscripcion')
  .then((res) => {
    callback(null, true);
  })
  .catch((error) => {
    logger.error(error);
    callback(null, false);
  });
};

module.exports.autenticar = autenticar;
module.exports.publicacion = publicacion;
module.exports.suscripcion = suscripcion;
