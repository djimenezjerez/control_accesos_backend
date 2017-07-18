const fs = require('fs');
const randomstring = require("randomstring");
const express = require('express');
const router = express.Router();
const logger = require('logger');
const cfg = require('configuracion');
const respuestas = require(`${cfg.directorio}/respuestas`);
const ip = require('obtener_ip');
const modelos = require('modelos_control_accesos');
const Arduino = modelos.Arduino;

/**
 * @api {get} /programas/:arduinoId Programa para grabar el arduino
 * @apiVersion 2.0.0
 * @apiGroup Programas
 * @apiParam {Number} arduinoId ID del arduino de control de puertas o interfaz sensorial
 * @apiSuccessExample {text} Success
 *    HTTP/1.1 200 OK
 *    #include &lt;SPI.h&gt;
 *    #include &lt;UIPEthernet.h&gt;
 *    ...
 *    void setup() {
 *    ...
 *    void loop() {
 *    ...
 * @apiError {json} 403 Datos erróneos
 *    HTTP/1.1 409 Forbidden
 *    {
 *      "error": "Datos erróneos"
 *    }
 * @apiError {json} 500 Error interno
 *    HTTP/1.1 500 Internal Error
 *    {
 *      "error": "Error interno del servidor"
 *    }
 * @apiErrorExample {json} 409 Servidor ocupado
 *    HTTP/1.1 409 Conflict
 *    {
 *      "error": "Datos erróneos"
 *    }
*/

router.get('/:arduinoId', (req, res) => {
  let claveAleatoria = randomstring.generate(cfg.sensor.longitudClave);

  Arduino.findById(req.params.arduinoId)
  .then((arduino) => {
    if(arduino != null && arduino.control) {
      return Promise.all([
        !cfg.puerta.logicaAbierta,
        arduino.pinesSalida.join(', '),
        new Promise((resolver, rechazar) => {
          let respuesta = [];
          arduino.mac.split(':').forEach((id) => {
            respuesta.push(`0x${id}`);
          });
          resolver(respuesta.join(', '));
        }),
        new Promise((resolver, rechazar) => {
          let respuesta = [];
          arduino.ip.split('.').forEach((id) => {
            respuesta.push(id);
          });
          resolver(respuesta.join(', '));
        }),
        arduino.getClienteMqtt(),
        arduino.id,
        new Promise((resolver, rechazar) => {
          if(!cfg.mqtt.servidor) {
            let respuesta = [];
            ip.obtenerIP().split('.').forEach((id) => {
              respuesta.push(id);
            });
            resolver(respuesta.join(', '));
          }
          else {
            resolver(cfg.mqtt.servidor);
          };
        })
      ])
      .then((respuesta) => {
        if(respuesta != null) {
          respuesta[4].updateAttributes({
            clave: claveAleatoria
          });
          let topico = `gpio/${respuesta[5]}/+`;
          return fs.readFileSync(`${__dirname}/../incluido/plantillaControl.ino`).toString()
          .replace(/estadoInicialPuertas/g, `${respuesta[0]}`)
          .replace(/pinesSalidas/g, `${respuesta[1]}`)
          .replace(/macRed/g, `${respuesta[2]}`)
          .replace(/ipArduino/g, `${respuesta[3]}`)
          .replace(/usuarioMqtt/g, `${respuesta[4].usuario}`)
          .replace(/claveMqtt/g, `${claveAleatoria}`)
          .replace(/gpioControl/g, topico)
          .replace(/ipServidor/g, `${respuesta[6]}`)
          .replace(/posicionPin/g, (topico.length - 1));
        }
        else {
          return null;
        }
      })
      .catch((err) => {
        logger.error(err);
        return null;
      });
    }
    else if(arduino != null && !arduino.control) {
      return Promise.all([
        new Promise((resolver, rechazar) => {
          let respuesta = [];
          arduino.mac.split(':').forEach((id) => {
            respuesta.push(`0x${id}`);
          });
          resolver(respuesta.join(', '));
        }),
        new Promise((resolver, rechazar) => {
          let respuesta = [];
          arduino.ip.split('.').forEach((id) => {
            respuesta.push(id);
          });
          resolver(respuesta.join(', '));
        }),
        arduino.getClienteMqtt(),
        arduino.id,
        arduino.getPuertaSensor()
        .then((puerta) => {
          return puerta.id;
        }),
        new Promise((resolver, rechazar) => {
          let respuesta = [];
          ip.obtenerIP().split('.').forEach((id) => {
            respuesta.push(id);
          });
          resolver(respuesta.join(', '));
        })
      ])
      .then((respuesta) => {
        if(respuesta != null) {
          respuesta[2].updateAttributes({
            clave: claveAleatoria
          });
          return fs.readFileSync(`${__dirname}/../incluido/plantillaSensor.ino`).toString()
          .replace(/macRed/g, `${respuesta[0]}`)
          .replace(/ipArduino/g, `${respuesta[1]}`)
          .replace(/usuarioMqtt/g, `${respuesta[2].usuario}`)
          .replace(/claveMqtt/g, `${claveAleatoria}`)
          .replace(/arduinoId/g, `${respuesta[3]}`)
          .replace(/puertaId/g, `${respuesta[4]}`)
          .replace(/ipServidor/g, `${respuesta[5]}`);
        }
        else {
          return null;
        }
      })
      .catch((err) => {
        logger.error(err);
        return null;
      });
    }
    else {
      return null;
    }
  })
  .then((respuesta) => {
    if(respuesta != null) {
      res.status(200).send(respuesta)
    }
    else {
      res.status(respuestas.error.datosErroneos.estado).json({
        error: respuestas.error.datosErroneos.mensaje
      });
    }
  })
  .catch((err) => {
    logger.error(err);
    res.status(respuestas.error.interno.estado).json({
      error: respuestas.error.interno.mensaje
    });
  });
});

module.exports = router;
