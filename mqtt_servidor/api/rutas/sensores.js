const express = require('express');
const router = express.Router();
const logger = require('logger');
const cfg = require('configuracion');
const respuestas = require(`${cfg.directorio}/respuestas`);
const modelos = require('modelos_control_accesos');

/**
 * @api {get} /sensores/verificarConexion/:idArduino Verificar la conexión de los sensores
 * @apiVersion 2.0.0
 * @apiGroup Sensores
 * @apiSuccess {String} mensaje Mensaje del estado de la conexión
 * @apiSuccessExample {json} Success
 *    HTTP/1.1 200 OK
 *    {
 *      "mensaje": "Verificación en curso"
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

router.get('/verificarConexion/:idArduino', (req, res) => {
  if(!global.ocupado) {
    process.send({
      tipo: 'comando',
      comando: 'verificarConexion',
      destino: req.params.idArduino,
      huellas: [1]
    });
    res.status(respuestas.correcto.completado.estado).json({
      mensaje: 'Verificación en curso'
    });
  }
  else {
    res.status(respuestas.error.ocupado.estado).json({
      error: respuestas.error.ocupado.mensaje
    });
  };
});

module.exports = router;
