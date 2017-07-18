const express = require('express');
const router = express.Router();
const logger = require('logger');
const cfg = require('configuracion');
const respuestas = require(`${cfg.directorio}/respuestas`);

/**
 * @api {get} /monitorMicroservicio/sincronizar Sincronizar manualmente ID's y usuarios desde el microservicio
 * @apiVersion 2.0.0
 * @apiGroup MonitorMicroservicio
 * @apiSuccess {String} mensaje Mensaje de disponibilidad
 * @apiSuccessExample {json} Success
 *    HTTP/1.1 200 OK
 *    {
 *      "mensaje": "Sincronizando"
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

router.get('/sincronizar', (req, res) => {
  process.send({
    tipo: 'monitorMicroservicio',
    canal: 'sincronizar',
    error: false
  });
  res.status(200).json({
    mensaje: 'Sincronizando'
  });
});

module.exports = router;
