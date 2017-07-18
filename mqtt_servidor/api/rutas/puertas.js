const express = require('express');
const router = express.Router();
const logger = require('logger');
const cfg = require('configuracion');
const respuestas = require(`${cfg.directorio}/respuestas`);
const modelos = require('modelos_control_accesos');
const Persona = modelos.Persona;
const PermisoAcceso = modelos.PermisoAcceso;

/**
 * @api {post} /puertas Abrir puertas
 * @apiVersion 2.0.0
 * @apiGroup Puertas
 * @apiParam {Number} persona ID de la persona que desea acceder
 * @apiParam {Number} puerta ID de la puerta que se desea abrir
 * @apiParamExample {json} Ejemplo
 *    {
 *      "persona": 1,
 *      "puerta": 4
 *    }
 * @apiSuccess {String} mensaje Mensaje de apertura correcta
 * @apiSuccessExample {json} Success
 *    HTTP/1.1 200 OK
 *    {
 *      "mensaje": "Abriendo puerta 4"
 *    }
 * @apiError {json} 401 No autorizado
 *    HTTP/1.1 401 Unauthorized
 *    {
 *      "error": "Usuario 1 no autorizado"
 *    }
 * @apiErrorExample {json} 401 No autorizado
 *    HTTP/1.1 401 Unauthorized
 *    {
 *      "error": "Usuario 1 no autorizado"
 *    }
*/

router.post('/', (req, res) => {
  PermisoAcceso.findOne({
    where: {
      persona: req.body.persona,
      puerta: req.body.puerta
    }
  })
  .then((resultado) => {
    if(resultado != null && resultado.fechaFin == null) {
      process.send({
        tipo: 'puerta',
        persona: req.body.persona,
        puerta: req.body.puerta
      });
      res.status(respuestas.correcto.completado.estado).json({
        mensaje: `Abriendo puerta ${req.body.puerta}`
      });
    }
    else if(resultado != null && resultado.fechaFin != null) {
      PermisoAcceso.findOne({
        where: {
          persona: req.body.persona,
          puerta: req.body.puerta,
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
      .then((permiso) => {
        if(permiso != null) {
          process.send({
            tipo: 'puerta',
            persona: req.body.persona,
            puerta: req.body.puerta
          });
          res.status(respuestas.correcto.completado.estado).json({
            mensaje: `Abriendo puerta ${req.body.puerta}`
          });
        }
        else {
          res.status(respuestas.error.noAutorizado.estado).json({
            error: `Usuario ${req.body.persona} ${respuestas.error.noAutorizado.mensaje}`
          });
        }
      })
      .catch((error) => {
        logger.error(error);
        res.status(respuestas.error.interno.estado).json({
          error: respuestas.error.interno.mensaje
        });
      });
    }
    else {
      res.status(respuestas.error.noAutorizado.estado).json({
        error: `Usuario ${req.body.persona} ${respuestas.error.noAutorizado.mensaje}`
      });
    };
  })
  .catch((error) => {
    logger.error(error);
    res.status(respuestas.error.interno.estado).json({
      error: respuestas.error.interno.mensaje
    });
  });
});

module.exports = router;
