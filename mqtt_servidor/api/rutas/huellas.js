const express = require('express');
const router = express.Router();
const logger = require('logger');
const cfg = require('configuracion');
const respuestas = require(`${cfg.directorio}/respuestas`);
const modelos = require('modelos_control_accesos');
const Arduino = modelos.Arduino;

/**
 * @api {get} /huellas Verificar la disponibilidad del servidor
 * @apiVersion 2.0.0
 * @apiGroup Huellas
 * @apiSuccess {String} mensaje Mensaje de disponibilidad
 * @apiSuccessExample {json} Success
 *    HTTP/1.1 200 OK
 *    {
 *      "mensaje": "Servicio disponible"
 *    }
 * @apiError {json} 409 Servidor ocupado
 *    HTTP/1.1 409 Conflict
 *    {
 *      "error": "Servidor ocupado"
 *    }
 * @apiErrorExample {json} 409 Servidor ocupado
 *    HTTP/1.1 409 Conflict
 *    {
 *      "error": "Servidor ocupado"
 *    }
*/

router.get('/', (req, res) => {
  if(!global.ocupado) {
    res.status(200).json({
      mensaje: 'Servicio disponible'
    });
  }
  else {
    res.status(respuestas.error.ocupado.estado).json({
      error: respuestas.error.ocupado.mensaje
    });
  };
});

/**
 * @api {put} /huellas/enviar Grabar nuevas huellas
 * @apiVersion 2.0.0
 * @apiGroup Huellas
 * @apiParam {Number} destino ID del sensor en el cual se grabará la o las nuevas huellas, "0" en caso de enviar a todos los sensores
 * @apiParam {Number[]} huellas ID o IDs de las huellas gue se desean enviar
 * @apiParamExample {json} Ejemplo
 *    {
 *      "destino": 0,
 *      "huellas": [1,21,45]
 *    }
 * @apiSuccess {String} mensaje Mensaje de envío correcto
 * @apiSuccessExample {json} Success
 *    HTTP/1.1 200 OK
 *    {
 *      "mensaje": "Enviando huellas 1,2"
 *    }
 * @apiError {json} 409 Servidor ocupado
 *    HTTP/1.1 409 Conflict
 *    {
 *      "error": "Servidor ocupado"
 *    }
 * @apiErrorExample {json} 409 Servidor ocupado
 *    HTTP/1.1 409 Conflict
 *    {
 *      "error": "Servidor ocupado"
 *    }
*/

router.put('/enviar', (req, res) => {
  if(!global.ocupado) {
    Arduino.findById(req.body.destino)
    .then((arduino) => {
      if(arduino != null || req.body.destino == 0) {
        process.send({
          tipo: 'comando',
          comando: 'grabar',
          destino: req.body.destino,
          huellas: req.body.huellas
        });
        res.status(respuestas.correcto.completado.estado).json({
          mensaje: `Enviando huellas ${req.body.huellas.join(',')}`
        });
      }
      else {
        res.status(respuestas.error.datosErroneos.estado).json({
          error: respuestas.error.datosErroneos.mensaje
        });
      };
    })
    .catch((error) => {
      logger.error(error);
      res.status(respuestas.error.interno.estado).json({
        error: respuestas.error.interno.mensaje
      });
    })
  }
  else {
    res.status(respuestas.error.ocupado.estado).json({
      error: respuestas.error.ocupado.mensaje
    });
  };
});

/**
 * @api {put} /huellas/borrar Borrar huellas almacenadas en el sensor
 * @apiVersion 2.0.0
 * @apiGroup Huellas
 * @apiParam {Number} destino ID de la o las huellas que se desean borrar de o de los sensores
 * @apiParam {Number[]} huellas ID o IDs de las huellas gue se desean borrar
 * @apiParamExample {json} Ejemplo
 *    {
 *      "destino": 0,
 *      "huellas": [1,21,45]
 *    }
 * @apiSuccess {String} mensaje Mensaje de eliminación correcta
 * @apiSuccessExample {json} Success
 *    HTTP/1.1 200 OK
 *    {
 *      "mensaje": "Eliminando huellas 1,2"
 *    }
 * @apiError {json} 409 Servidor ocupado
 *    HTTP/1.1 409 Conflict
 *    {
 *      "error": "Servidor ocupado"
 *    }
 * @apiErrorExample {json} 409 Servidor ocupado
 *    HTTP/1.1 409 Conflict
 *    {
 *      "error": "Servidor ocupado"
 *    }
*/

router.put('/borrar', (req, res) => {
  if(!global.ocupado) {
    Arduino.findById(req.body.destino)
    .then((arduino) => {
      if(arduino != null || req.body.destino == 0) {
        process.send({
          tipo: 'comando',
          comando: 'borrar',
          destino: req.body.destino,
          huellas: req.body.huellas
        });
        res.status(respuestas.correcto.completado.estado).json({
          mensaje: `Borrando huella ${req.body.huellas.join(',')}`
        });
      }
      else {
        res.status(respuestas.error.datosErroneos.estado).json({
          error: respuestas.error.datosErroneos.mensaje
        });
      };
    })
    .catch((error) => {
      logger.error(error);
      res.status(respuestas.error.interno.estado).json({
        error: respuestas.error.interno.mensaje
      });
    })
  }
  else {
    res.status(respuestas.error.ocupado.estado).json({
      error: respuestas.error.ocupado.mensaje
    });
  };
});

module.exports = router;
