const logger = require('logger');
const modelos = require('modelos_control_accesos');
const Persona = modelos.Persona;
const Puerta = modelos.Puerta;
const Acceso = modelos.Acceso;
const PermisoAcceso = modelos.PermisoAcceso;

module.exports = {};

/**
 * @api {get} accesos Nuevo acceso de una persona por una puerta
 * @apiVersion 2.0.0
 * @apiGroup Accesos
 * @apiSuccess {Boolean} error 1 para definir error, 0 para definir correcto
 * @apiSuccess {String} mensaje Mensaje de notificación
 * @apiSuccess {Object} Persona Objecto con los datos de la persona que accedió
 * @apiSuccess {Object} Puerta Objecto con los datos de la puerta por la cual se accedió
 * @apiSuccess {Date} fechaHora Hora del acceso
 * @apiSuccessExample {json} Success
 *    HTTP/2.0 200 OK
 *    {
 *      "error": false,
 *      "mensaje": Usuario 1 ingresa por la puerta 1,
 *      "Persona": {
 *        "id": 1,
 *        "nombre": "usuario1"
 *      },
 *      "Puerta": {
 *        "id": 1,
 *        "nombre": "P1",
 *        "estadoInicial": true,
 *        "estadoActual": true,
 *        "detalle": "Puerta 1"
 *      },
 *      "fechaHora": "2017-01-01T08:00:00.000Z"
 *    }
 */

let nuevoAcceso = (persona, puerta) => {
  Promise.all([
    Persona.findById(persona, {
      attributes: {
        exclude: ['grabado', 'createdAt', 'updatedAt']
      }
    }),
    Puerta.findById(puerta, {
      attributes: {
        exclude: ['pin', 'arduinoControl', 'createdAt', 'updatedAt']
      }
    })
  ]).then((res) => {
    global.socket.send({
      canal: 'accesos',
      mensaje: {
        error: false,
        mensaje: `Usuario ${persona} ingresa por la puerta ${puerta}`,
        Persona: res[0],
        Puerta: res[1],
        fechaHora: new Date()
      }
    });
  }).catch((err) => {
    logger.error(err);
  });
  return Acceso.create({
    persona: persona,
    puerta: puerta
  })
};

let insertar = (mensaje) => {
  return new Promise((resolver, rechazar) => {
    let personaId = parseInt(mensaje.payload, 16);
    let puertaId = Number(mensaje.topic.split('/')[1]);
    return PermisoAcceso.findOne({
      where: {
        persona: personaId,
        puerta: puertaId
      }
    })
    .then((res) => {
      if(res != null && res.fechaFin == null) {
        return nuevoAcceso(personaId, puertaId)
        .then((resultado) => {
          logger.verbose(`Usuario ${personaId} ingresa por la puerta ${puertaId}`);
          return resolver({
            persona: personaId,
            puerta: puertaId
          })
        })
        .catch((error) => {
          return rechazar(error);
        });
      }
      else if(res != null && res.fechaFin != null) {
        PermisoAcceso.findOne({
          where: {
            persona: personaId,
            puerta: puertaId,
            $not: {
              $or: [
                {
                  fechaInicio: {
                    $gt: new Date()
                  }
                }, {
                  fechaFin: {
                    $lt: new Date()
                  }
                }
              ]
            }
          }
        })
        .then((res) => {
          if(res != null) {
            return nuevoAcceso(personaId, puertaId)
            .then((resultado) => {
              logger.info(`Usuario ${personaId} ingresa por la puerta ${puertaId}`);
              return resolver({
                persona: personaId,
                puerta: puertaId
              })
            })
            .catch((error) => {
              return rechazar(error);
            });
          }
          else {
            return rechazar(`El usuario ${personaId} no tiene permiso para acceder por la puerta ${puertaId}`);
          }
        })
        .catch((error) => {
          return rechazar(error);
        });
        return null;
      }
      else {
        return rechazar(`El usuario ${personaId} no tiene permiso para acceder por la puerta ${puertaId}`);
      };
    })
    .catch((error) => {
      return rechazar(error);
    });
  });
};

module.exports.insertar = insertar;
