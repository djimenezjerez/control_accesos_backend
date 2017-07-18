const fs = require('fs');
const PNG = require('pngjs').PNG;
const cfg = require('configuracion');
const ip = require('obtener_ip');
const epilogue = require('epilogue');
const restify = require('restify');
const _ = require('lodash');
const each = require('each');
const jsonwebtoken = require('jsonwebtoken');
const jwt = require('restify-jwt');
const logger = require('logger');
const ldap = require('ldapjs');
const acl =  require('restify-acl');
const hasher = require('hasher');
const modelos = require('modelos_control_accesos');
const respuestas = require(`${cfg.directorio}/respuestas`);

const key = fs.readFileSync(`${cfg.directorio}/${cfg.certificado.ruta}/${cfg.certificado.nombre}.key`);
const cert = fs.readFileSync(`${cfg.directorio}/${cfg.certificado.ruta}/${cfg.certificado.nombre}.crt`);

let firmarToken = (usuario, rol) => {
  return new Promise((resolver, rechazar) => {
    jsonwebtoken.sign({
      usuario: usuario,
      role: rol
    }, key, {
      expiresIn: cfg.jwt.tiempoExpiracion,
      algorithm: cfg.jwt.algoritmo
    }, (err, token) => {
      if(err) {
        return rechazar(err)
      }
      else {
        return resolver(token);
      };
    });
  })
};

acl.config({
  filename: 'acl.json',
  path: cfg.directorio,
  baseUrl: `/v${cfg.apiAdmin.version}`
});

let clienteLdap = ldap.createClient({
  url: `${Boolean(cfg.ldap.tls) ? 'ldaps' : 'ldap'}://${cfg.ldap.servidor}:${cfg.ldap.puerto}`,
  tlsOptions: {
    rejectUnauthorized: !Boolean(cfg.ldap.tls)
  },
  timeout: 1000 * 15,
  idleTimeout: 1000 * 3600,
  reconnect: true
});

clienteLdap.on('connect', () => {
  logger.verbose(`Conectado al servidor ${Boolean(cfg.ldap.tls) ? 'ldaps' : 'ldap'}://${cfg.ldap.servidor}:${cfg.ldap.puerto}`);
});

clienteLdap.on('error', (err) => {
  logger.error(err);
});

let clienteApi = restify.createJsonClient({
  url: `https://${cfg.api.servidor}:${cfg.api.puerto}`,
  rejectUnauthorized: false
});

let clienteApiString = restify.createStringClient({
  url: `https://${cfg.api.servidor}:${cfg.api.puerto}`,
  rejectUnauthorized: false
});

let clienteRegistrador = restify.createJsonClient({
  url: `https://${cfg.registrador.servidor}:${cfg.registrador.puerto}`,
  rejectUnauthorized: false
});

let app = restify.createServer({
  spdy: {
    key: key,
    cert: cert,
    protocols: ['h2', 'spdy/3.1', 'http/1.1'],
    plain: false,
    'x-forwarded-for': true,
    connection: {
      windowSize: 1024 * 1024,
      autoSpdy31: false
    }
  }
});

app.use((req, res, next) => {
  req.originalUrl = req.url;
  next();
});

app.use((req, res, siguiente) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header('Access-Control-Allow-Headers', 'Origin, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Response-Time, X-PINGOTHER, X-CSRF-Token, Authorization, Access-Control-Allow-Origin');
  res.header('Access-Control-Allow-Methods', 'DELETE, PATCH, GET, HEAD, POST, PUT, OPTIONS, TRACE');
  res.header('Access-Control-Expose-Headers', 'X-Api-Version, X-Request-Id, X-Response-Time, Authorization');
  res.header('Access-Control-Max-Age', '1000');
  siguiente();
});

app.on('MethodNotAllowed', (req, res) => {
  if(req.method && req.method.toLowerCase() === 'options') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Response-Time, X-PINGOTHER, X-CSRF-Token, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, PATCH, GET, HEAD, POST, PUT, OPTIONS, TRACE');
    res.setHeader('Access-Control-Expose-Headers', 'X-Api-Version, X-Request-Id, X-Response-Time, Authorization');
    res.setHeader('Access-Control-Max-Age', '1000');
    return res.send(204);
  }
  else {
    logger.error(`Método no existente ${req.method} para ${req.url}`)
    return res.send(new restify.MethodNotAllowedError());
  };
});

app.pre(restify.pre.sanitizePath());
app.use(restify.queryParser());
app.use(restify.bodyParser());

app.use(jwt({
  secret: cert,
  credentialsRequired: true,
  algorithms: [cfg.jwt.algoritmo],
  requestProperty: 'decoded',
  getToken: (req) => {
    if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
      return req.headers.authorization.split(' ')[1];
    }
    else if(req.query && req.query.token) {
      return req.query.token;
    }
    return null;
  }
}).unless({
  path: [`/v${cfg.apiAdmin.version}/autenticar`]
}));

app.use(acl.authorize.unless({
  path: [`/v${cfg.apiAdmin.version}/autenticar`]
}));

app.pre((req, res, next) => {
  let client = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  logger.info(`[${client}] ${req.method} : ${req.url}`)
  next();
});

app.on('after', (req, res, rout, err) => {
  let client = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  logger.info(`[${client}] ${req.method} ${res.statusCode} - ${req.url}`);
  if(err) {
    logger.error(err);
  };
});

app.on('uncaughtException', (req, res, route, error) => {
  logger.error(error)
});

/**
 * @api {post} /autenticar Obtener un token para las consultas
 * @apiVersion 2.0.0
 * @apiGroup Autenticacion
 * @apiParam {String} usuario Nombre de usuario de LDAP
 * @apiParam {String} clave Contraseña para el usuario de LDAP
 * @apiParamExample {json} Ejemplo
 *    {
 *      "usuario": "pepito",
 *      "clave": "grillo"
 *    }
 * @apiSuccess {String} mensaje Mensaje de grabación correcta
 * @apiSuccessExample {json} Success
 *    HTTP/2 200 OK
 *    {
 *      "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c3VhcmlvIjoicGVwaXRvIiwicm9sZSI6InVzZXIiLCJpYXQiOjE0OTMwNjE4MTEsImV4cCI6MTQ5MzA3NjIxMX0.MDvw1C_Ij6NglnEe45eZfr0Af5fkhqRn4_Uu-6n4NDHxc-1Z-FWoGj_4Yga2FlIylSwQeimmHg4dThYqnFSAA9CZl0vTf_PEw9w3xQbPkSGFMpoMUnamt9W7QLyFs1BFmJJtaMd2YYbUOslQKfVMd7Z9hbOF8AMfYPdCgsYgOb4"
 *    }
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "error":"Usuario o contraseña incorrecta"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "error":"Usuario o contraseña incorrecta"
 *    }
 */

app.post(`/v${cfg.apiAdmin.version}/autenticar`, (req, res) => {
  modelos.ClienteMqtt.findOne({
    where: {
      $and: {
        usuario: req.body.usuario,
        admin: true
      }
    }
  })
  .then((resultado) => {
    if(resultado) {
      return hasher.verificarHash(req.body.clave, resultado.clave)
      .then((verificado) => {
        if(verificado) {
          return firmarToken(req.body.usuario, 'admin');
        }
        else {
          return false;
        };
      })
      .catch((err) => {
        logger.error(err);
        return false;
      });
    }
    else {
      return new Promise((resolver, rechazar) => {
        clienteLdap.bind(`${cfg.ldap.identificador}=${req.body.usuario},${cfg.ldap.basedn}`, req.body.clave, (err) => {
          if(err) {
            rechazar(err);
          }
          else {
            resolver(firmarToken(req.body.usuario, 'user'));
          };
        });
      })
    }
  })
  .then((token) => {
    res.send(respuestas.correcto.estado, {
      token: token
    });
  })
  .catch((err) => {
    logger.error(err);
    res.send(respuestas.error.loginIncorrecto.estado, {
      error: respuestas.error.loginIncorrecto.mensaje
    });
  });
});

/**
 * @api {get} /programas/:arduinoId Arduino GPIO
 * @apiVersion 2.0.0
 * @apiGroup Programas
 * @apiParam {Number} arduinoId ID del arduino de control de puertas
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

app.get(`/v${cfg.apiAdmin.version}/programas/:arduinoId`, (req, res) => {
  clienteApiString.get(`/v${cfg.apiAdmin.version}/programas/${req.params.arduinoId}`, (error, request, response, data) => {
    res.header("Content-Type", "application/xml");
    res.send(response.statusCode, data);
  });
});

/**
 * @api {get} /permisosAccesoIndefinido Obtener la lista de permisos de acceso indefinido
 * @apiVersion 2.0.0
 * @apiGroup PermisosAcceso
 * @apiSuccess {Object[]} Lista Lista de accesos indefinidos
 * @apiSuccessExample {Object[]} Success
 *    HTTP/2 200 OK
 *    [
 *      {
 *        "persona": "1",
 *        "nombre": "usuario1",
 *        "puertas": [
 *          {
 *            "puerta": 1,
 *            "permiso": true
 *          },
 *          {
 *            "puerta": 2,
 *            "permiso": false
 *          },
 *          {
 *            "puerta": 3,
 *            "permiso": false
 *          },
 *          {
 *            "puerta": 4,
 *            "permiso": false
 *          }
 *        ]
 *      },
 *      {
 *        "persona": "2",
 *        "nombre": "usuario2",
 *        "puertas": [
 *          {
 *            "puerta": 1,
 *            "permiso": true
 *          },
 *          {
 *            "puerta": 2,
 *            "permiso": true
 *          },
 *          {
 *            "puerta": 3,
 *            "permiso": false
 *          },
 *          {
 *            "puerta": 4,
 *            "permiso": true
 *          }
 *        ]
 *      }
 *    ]
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 */

app.get(`/v${cfg.apiAdmin.version}/permisosAccesoIndefinido`, (req, res) => {
  Promise.all([
    modelos.Puerta.findAll({
      attributes: ['id']
    }),
    modelos.PermisoAcceso.findAll({
      where: {
        fechaFin: null
      },
      attributes: ['id', 'persona', 'puerta'],
      include: [
        {
          model: modelos.Persona,
          attributes: ['nombre']
        }
      ]
    })
  ]).then((r) => {
    let puertas = r[0].map(item => item.id);

    let permisos = _(r[1]).map((x) => {
      return {
        persona: x.persona,
        nombre: x.Persona.nombre,
        puerta: x.puerta,
        id: x.id
      }
    }).groupBy('persona').map((item, key) => {
      return {
        persona: key,
        nombre: item[0].nombre,
        puertas: _.map(item).map((p) => {
          return {
            puerta: p.puerta,
            permiso: true,
            id: p.id
          }
        })
      }
    }).value();

    return [puertas, permisos]
  }).then((r) => {
    let puertas = r[0];
    let permisos = r[1];

    return new Promise((resolver, rechazar) => {
      each(permisos)
      .call((p, indiceP, siguienteP) => {
        let puertasAux = puertas;
        each(p.puertas)
        .call((x, indiceX, siguienteX) => {
          puertasAux = _.without(puertasAux, x.puerta);
          siguienteX();
        })
        .then((err) => {
          each(puertasAux)
          .call((puerta, indiceA, siguienteA) => {
            p.puertas.push({
              puerta: puerta,
              permiso: false,
              id: null
            });
            siguienteA();
          })
          .then((err) => {
            p.puertas = _.sortBy(p.puertas, 'puerta');
            siguienteP();
          });
        });
      })
      .then((err) => {
        if(err) {
          logger.error(err)
        }
        resolver(_.sortBy(permisos, 'nombre'));
      });
    });
  }).then((r) => {
    res.send(200, r);
  }).catch((err) => {
    logger.error(err);
    res.send(respuestas.error.interno.estado, {
      error: respuestas.error.interno.mensaje
    });
  });
});

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

app.get(`/v${cfg.apiAdmin.version}/monitorMicroservicio/sincronizar`, (req, res) => {
  clienteRegistrador.patch(`/v${cfg.registrador.version}/ldap`, () => {
    clienteApi.get(`/v${cfg.api.version}/monitorMicroservicio/sincronizar`, (error, request, response, object) => {
      res.send(response.statusCode, object);
    });
  });
});

/**
 * @api {get} /huellas/:id Envía la imagen de la huella seleccionada
 * @apiVersion 2.0.0
 * @apiGroup Huellas
 * @apiParam {Number} id ID de la persona de la que se desea recuperar la imagen
 * @apiError {json} 500 Error interno
 *    HTTP/2 500
 *    {
 *      "error": true,
 *      "mensaje": "Conexión perdida con el sensor"
 *    }
 * @apiErrorExample {json} 500 Error interno
 *    HTTP/2 500
 *    {
 *      "error": true,
 *      "mensaje": "Error interno del servidor"
 *    }
 */

app.get(`/v${cfg.apiAdmin.version}/huellas/:id`, (req, res) => {
  clienteRegistrador.get(`/v${cfg.registrador.version}/huellas/${req.params.id}`, (error, request, response, data) => {
    let png = new PNG({
      width: 256,
      height: 288,
      filterType: -1,
    })
    png.data = new Buffer(data.imagen.replace(/(.{1})/g,"$10$10$10ff"),'hex');
    let buffer = PNG.sync.write(png);

    res.writeHead(200, {
      'Content-Type': 'image/png'
    });
    res.end(buffer, 'binary');
  });
});

/**
 * @api {get} /huellas/:id Verifica si existe la imagen de una huella
 * @apiVersion 2.0.0
 * @apiGroup Huellas
 * @apiParam {Number} id ID de la persona de la que se desea recuperar la imagen
 * @apiSuccess {json} 200 Exitoso
 * @apiError {json} 404 Huella no existente
 * @apiError {json} 500 Error interno
 */

app.head(`/v${cfg.apiAdmin.version}/huellas/:id`, (req, res) => {
  clienteRegistrador.head(`/v${cfg.registrador.version}/huellas/${req.params.id}`, (error, request, response, object) => {
    res.send(response.statusCode, object);
  });
});

/**
* @api {post} /huellas/grabar Grabar una nueva huella o actualizar una existente
* @apiVersion 2.0.0
* @apiGroup Huellas
* @apiParam {Number} id ID de la persona que se desea grabar sus huellas
 * @apiParamExample {json} Ejemplo
*    {
*      "id": 2
*    }
* @apiSuccess {Boolean} error Estado de error
* @apiSuccess {Object} mensaje Mensaje de respuesta
* @apiSuccessExample {json} Success
*    HTTP/2 200 OK
*    {
*      "error": false,
*      "mensaje": "Huella de usuario jdoe actualizada"
*    }
* @apiError {json} 500 Error interno
*    HTTP/2 500
*    {
*      "error": true,
*      "mensaje": "Conexión perdida con el sensor"
*    }
* @apiErrorExample {json} 401 No Autorizado
*    HTTP/2 500
*    {
*      "error": true,
*      "mensaje": "No se detectó ninguna huella"
*    }
*/

app.post(`/v${cfg.apiAdmin.version}/huellas/grabar`, (req, res) => {
  clienteRegistrador.post(`/v${cfg.registrador.version}/huellas`, req.body, (error, request, response, object) => {
    if(response.statusCode == 200) {
      modelos.Persona.update({
        grabado: false
      }, {
        where: {
          id: req.body.id
        }
      })
      .then((respuesta) => {
        res.send(response.statusCode, object);
      })
      .catch((err) => {
        logger.error(err);
        res.send(respuestas.error.interno.estado, {
          error: true,
          mensaje: respuestas.error.interno.mensaje
        });
      });
    }
    else {
      res.send(response.statusCode, object);
    };
  });
});

/**
 * @api {put} /huellas/enviar Enviar huellas a los sensores
 * @apiVersion 2.0.0
 * @apiGroup Huellas
 * @apiParam {Number} destino ID del sensor en el cual se grabará la o las nuevas huellas, "0" en caso de grabar a todos los sensores
 * @apiParam {Number[]} huellas ID o IDs de las huellas gue se desean enviar
 * @apiParamExample {json} Ejemplo
 *    {
 *      "destino": 0,
 *      "huellas": [1,21,45]
 *    }
 * @apiSuccess {String} mensaje Mensaje de grabación correcta
 * @apiSuccessExample {json} Success
 *    HTTP/1.1 200 OK
 *    {
 *      "mensaje": "Grabando huellas 1,2"
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

app.put(`/v${cfg.apiAdmin.version}/huellas/enviar`, (req, res) => {
  clienteApi.put(`/v${cfg.api.version}/huellas/enviar`, req.body, (error, request, response, object) => {
    res.send(response.statusCode, object);
  });
});

/**
 * @api {put} /huellas/borrar Borrar huellas
 * @apiVersion 2.0.0
 * @apiGroup Huellas
 * @apiParam {Number} destino ID del sensor en el cual se grabará la o las nuevas huellas, "0" en caso de grabar a todos los sensores
 * @apiParam {Number[]} huellas ID o IDs de las huellas gue se desean borrar
 * @apiParamExample {json} Ejemplo
 *    {
 *      "destino": 0,
 *      "huellas": [1,21,45]
 *    }
 * @apiSuccess {String} mensaje Mensaje de grabación correcta
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

app.put(`/v${cfg.apiAdmin.version}/huellas/borrar`, (req, res) => {
  clienteApi.put(`/v${cfg.apiAdmin.version}/huellas/borrar`, req.body, (error, request, response, object) => {
    res.send(response.statusCode, object);
  });
});

/**
 * @api {post} /puerta/abrirPuerta Abrir una puerta mediante el usuario conectado
 * @apiVersion 2.0.0
 * @apiGroup Puertas
 * @apiParam {Number} puerta ID de la puerta que se desea abrir
 * @apiParamExample {json} Ejemplo
 *    {
 *      "puerta": 1
 *    }
 * @apiSuccess {String} mensaje Mensaje de grabación correcta
 * @apiSuccessExample {json} Success
 *    HTTP/2 200 OK
 *    {
 *      "mensaje": "Abriendo puerta 4"
 *    }
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "error": "Usuario 1 no autorizado"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "error": "Usuario 1 no autorizado"
 *    }
 */

app.post(`/v${cfg.apiAdmin.version}/puerta/abrirPuerta`, (req, res) => {
  if (req.decoded.role != 'admin') {
    modelos.Persona.findOne({
      where: {
        nombre: req.decoded.usuario
      }
    })
    .then((persona) => {
      req.body.persona = persona.id;
      clienteApi.post(`/v${cfg.apiAdmin.version}/puertas`, req.body, (error, request, response, object) => {
        res.send(response.statusCode, object);
      });
    })
  } else {
    res.send(respuestas.error.noAutorizado.estado, {
      error: respuestas.error.noAutorizado.mensaje
    });
  }
});

epilogue.initialize({
  app: app,
  sequelize: modelos.sequelize
});

/**
 * @api {get} /accesos Obtener la lista de accesos
 * @apiVersion 2.0.0
 * @apiGroup Accesos
 * @apiSuccess {Object[]} Lista Lista de accesos
 * @apiSuccessExample {Object[]} Success
 *    HTTP/2 200 OK
 *    [
 *      {
 *        "id": 1,
 *        "fechaHora": "2017-01-01T08:00:00.000Z",
 *        "Puerta": {
 *          "id": 1,
 *          "nombre": "P1",
 *          "estadoInicial": true,
 *          "estadoActual": true,
 *          "detalle": "Puerta 1"
 *        },
 *          "Persona": {
 *          "id": 1,
 *          "nombre": "usuario1"
 *        }
 *      }, {
 *        "id": 2,
 *        "fechaHora": "2017-01-02T09:00:00.000Z",
 *        "Puerta": {
 *          "id": 2,
 *          "nombre": "P2",
 *          "estadoInicial": true,
 *          "estadoActual": true,
 *          "detalle": "Puerta 2"
 *        },
 *        "Persona": {
 *          "id": 2,
 *          "nombre": "usuario2"
 *        }
 *      }
 *    ]
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 */

/**
 * @api {get} /accesos/:id Obtener los datos de un registro específico de acceso
 * @apiVersion 2.0.0
 * @apiGroup Accesos
 * @apiSuccess {Number} id Id de la tabla de historial de accesos
 * @apiSuccess {Date} fechaHora Fecha y hora del acceso
 * @apiSuccess {Number} persona Id de la persona que ingresó
 * @apiSuccess {Number} puerta Id de la puerta que abrió
 * @apiSuccessExample {json} Success
 *    HTTP/2 200 OK
 *    {
 *      "id": 1,
 *      "fechaHora": "2017-01-01T08:00:00.000Z",
 *      "Puerta": {
 *        "id": 1,
 *        "nombre": "P1",
 *        "estadoInicial": true,
 *        "estadoActual": true,
 *        "detalle": "Puerta 1"
 *      },
 *        "Persona": {
 *        "id": 1,
 *        "nombre": "usuario1"
 *      }
 *    }
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 */

epilogue.resource({
  model: modelos.Acceso,
  endpoints: [`/v${cfg.apiAdmin.version}/accesos`, `/v${cfg.apiAdmin.version}/accesos/:id`],
  actions: ['list', 'read'],
  excludeAttributes: ['deletedAt', 'persona', 'puerta'],
  include: [
    {
      model: modelos.Puerta,
      attributes: ['id', 'nombre', 'estadoInicial', 'estadoActual', 'detalle']
    }, {
      model: modelos.Persona,
      attributes: ['id', 'nombre']
    }
  ],
  search: [
    {
      param: 'fechaInicio',
      attributes: ['fechaHora'],
      operator: '$gte'
    }, {
      param: 'fechaFin',
      attributes: ['fechaHora'],
      operator: '$lte'
    }
  ]
});

/**
 * @api {get} /clientesMqtt Obtener la lista de Clientes Mqtt
 * @apiVersion 2.0.0
 * @apiGroup ClientesMqtt
 * @apiSuccess {Object[]} Lista Lista de Clientes Mqtt
 * @apiSuccessExample {Object[]} Success
 *    HTTP/2 200 OK
 *    [
 *      {
 *        "id": 1,
 *        "usuario": "admin",
 *        "conectado": false,
 *        "admin": true,
 *        "createdAt": "2017-01-01T00:00:00.000Z",
 *        "updatedAt": "2017-01-01T00:00:00.000Z"
 *      }
 *    ]
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 */

 /**
  * @api {get} /clientesMqtt/:id Obtener los detalles de un Clientes Mqtt
  * @apiVersion 2.0.0
  * @apiGroup ClientesMqtt
  * @apiSuccess {Number} id Id del cliente mqtt
  * @apiSuccess {String} usuario Nombre de usuario del cliente mqtt
  * @apiSuccess {Boolean} conectado 1 si el cliente está conectado, 0 si el cliente está desconectado
  * @apiSuccess {Boolean} admin 1 si el cliente es administrador, 0 si el cliente no es administrador
  * @apiSuccess {Date} createdAt Fecha de creación del registro
  * @apiSuccess {Date} updatedAt Fecha de alteración del registro
  * @apiSuccessExample {Object[]} Success
  *    HTTP/2 200 OK
  *    {
  *      "id": 1,
  *      "usuario": "admin",
  *      "conectado": false,
  *      "admin": true,
  *      "createdAt": "2017-01-01T00:00:00.000Z",
  *      "updatedAt": "2017-01-01T00:00:00.000Z"
  *    }
  * @apiError {json} 401 No Autorizado
  *    HTTP/2 401
  *    {
  *      "code": "InvalidCredentials",
  *      "message": "No authorization token was found"
  *    }
  * @apiErrorExample {json} 401 No Autorizado
  *    HTTP/2 401
  *    {
  *      "code": "InvalidCredentials",
  *      "message": "No authorization token was found"
  *    }
  */

/**
 * @api {post} /clientesMqtt Crear un nuevo Clientes Mqtt
 * @apiVersion 2.0.0
 * @apiGroup ClientesMqtt
 * @apiParam {String} usuario Nombre de usuario del cliente mqtt
 * @apiParam {String} clave Clave para el nuevo usuario del cliente mqtt
 * @apiParam {Boolean} admin 1 si el cliente es administrador, 0 si el cliente no es administrador
 * @apiParamExample {json} Cliente
 *    {
 *      "usuario": "nuevoCliente",
 *      "clave": "nuevaClave",
 *      "admin": false
 *    }
 * @apiSuccess {Number} id Id del cliente mqtt
 * @apiSuccess {String} usuario Nombre de usuario del cliente mqtt
 * @apiSuccess {Boolean} conectado 1 si el cliente está conectado, 0 si el cliente está desconectado
 * @apiSuccess {Boolean} admin 1 si el cliente es administrador, 0 si el cliente no es administrador
 * @apiSuccess {Date} createdAt Fecha de creación del registro
 * @apiSuccess {Date} updatedAt Fecha de alteración del registro
 * @apiSuccessExample {Object} Success
 *    HTTP/2 200 OK
 *    {
 *      "id": 1,
 *      "usuario": "admin",
 *      "conectado": false,
 *      "admin": true,
 *      "createdAt": "2017-01-01T00:00:00.000Z",
 *      "updatedAt": "2017-01-01T00:00:00.000Z"
 *    }
 * @apiError {json} 400 Consulta errónea
 *    HTTP/2 400
 *    {
 *      "message": "Validation error",
 *      "errors": [
 *        {
 *          "field": "PARÁMETRO",
 *          "message": "PARÁMETRO must be unique"
 *        }
 *      ]
 *    }
 * @apiError {json} 400 Consulta errónea
 *    HTTP/2 400
 *    {
 *      "message": "notNull Violation: PARÁMETRO cannot be null",
 *      "errors": [
 *        {
 *          "field": "PARÁMETRO",
 *          "message": "PARÁMETRO cannot be null"
 *        }
 *      ]
 *    }
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 */

/**
 * @api {put} /clientesMqtt/:id Actualizar un Clientes Mqtt
 * @apiVersion 2.0.0
 * @apiGroup ClientesMqtt
 * @apiParam {String} usuario Nombre de usuario del cliente mqtt
 * @apiParam {String} clave Clave para el nuevo usuario del cliente mqtt
 * @apiParam {Boolean} admin 1 si el cliente es administrador, 0 si el cliente no es administrador
 * @apiParamExample {json} Cliente
 *    {
 *      "usuario": "actualizacionCliente",
 *      "clave": "actualizacionClave",
 *      "admin": true
 *    }
 * @apiSuccess {Number} id Id del cliente mqtt
 * @apiSuccess {String} usuario Nombre de usuario del cliente mqtt
 * @apiSuccess {Boolean} conectado 1 si el cliente está conectado, 0 si el cliente está desconectado
 * @apiSuccess {Boolean} admin 1 si el cliente es administrador, 0 si el cliente no es administrador
 * @apiSuccess {Date} createdAt Fecha de creación del registro
 * @apiSuccess {Date} updatedAt Fecha de alteración del registro
 * @apiSuccessExample {Object} Success
 *    HTTP/2 200 OK
 *    {
 *      "id": 1,
 *      "usuario": "admin",
 *      "conectado": false,
 *      "admin": true,
 *      "createdAt": "2017-01-01T00:00:00.000Z",
 *      "updatedAt": "2017-01-02T00:00:00.000Z"
 *    }
 * @apiError {json} 400 Consulta errónea
 *    HTTP/2 400
 *    {
 *      "message": "Validation error",
 *      "errors": [
 *        {
 *          "field": "PARÁMETRO",
 *          "message": "PARÁMETRO must be unique"
 *        }
 *      ]
 *    }
 * @apiError {json} 400 Consulta errónea
 *    HTTP/2 400
 *    {
 *      "message": "notNull Violation: PARÁMETRO cannot be null",
 *      "errors": [
 *        {
 *          "field": "PARÁMETRO",
 *          "message": "PARÁMETRO cannot be null"
 *        }
 *      ]
 *    }
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 */

/**
 * @api {delete} /clientesMqtt/:id Eliminar un Clientes Mqtt
 * @apiVersion 2.0.0
 * @apiGroup ClientesMqtt
 * @apiSuccess {Object} Success Objeto vacío, elemento eliminado
 * @apiSuccessExample {Object} Success
 *    HTTP/2 200 OK
 *    {}
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 */

epilogue.resource({
  model: modelos.ClienteMqtt,
  endpoints: [`/v${cfg.apiAdmin.version}/clientesMqtt`, `/v${cfg.apiAdmin.version}/clientesMqtt/:id`],
  excludeAttributes: ['clave', 'deletedAt', 'createdAt']
});

/**
 * @api {get} /puertas Obtener la lista de puertas
 * @apiVersion 2.0.0
 * @apiGroup Puertas
 * @apiSuccess {Object[]} Lista Lista de puertas
 * @apiSuccessExample {Object[]} Success
 *    HTTP/2 200 OK
 *    [
 *      {
 *       "id": 1,
 *       "nombre": "P1",
 *       "pin": 0,
 *       "estadoInicial": true,
 *       "estadoActual": true,
 *       "detalle": "Puerta 1",
 *       "createdAt": "2017-01-01T00:00:00.000Z",
 *       "updatedAt": "2017-01-02T00:00:00.000Z"
 *       "arduinoControl": 1
 *      },
 *      {
 *       "id": 2,
 *       "nombre": "P2",
 *       "pin": 1,
 *       "estadoInicial": true,
 *       "estadoActual": true,
 *       "detalle": "Puerta madera derecha",
 *       "createdAt": "2017-01-01T00:00:00.000Z",
 *       "updatedAt": "2017-01-02T00:00:00.000Z"
 *       "arduinoControl": 1
 *      }
 *    ]
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 */

/**
 * @api {get} /puertas/:id Obtener los detalles de una puerta
 * @apiVersion 2.0.0
 * @apiGroup Puertas
 * @apiSuccess {Number} id Id de la puerta
 * @apiSuccess {String} nombre Nombre código de la puerta
 * @apiSuccess {Number} pin Pin del arduino de control al cual se conecta la puerta
 * @apiSuccess {Boolean} estadoInicial 1 si el estado inicial debe ser alto, 0 si el estado inicial debe ser bajo
 * @apiSuccess {Boolean} estadoActual 1 si se encuentra en estado alto, 0 si se encuentra en estado bajo
 * @apiSuccess {String} detalle Detalle o ubicación de la puerta
 * @apiSuccess {Number} arduinoControl Id del arduino de control que activa o desactiva esta puerta
 * @apiSuccess {Date} createdAt Fecha de creación del registro
 * @apiSuccess {Date} updatedAt Fecha de alteración del registro
 * @apiSuccessExample {Object[]} Success
 *    HTTP/2 200 OK
 *    {
 *      "id": 1,
 *      "nombre": "P1",
 *      "pin": 0,
 *      "estadoInicial": true,
 *      "estadoActual": true,
 *      "detalle": "Puerta 1",
 *      "createdAt": "2017-01-01T00:00:00.000Z",
 *      "updatedAt": "2017-01-02T00:00:00.000Z"
 *      "arduinoControl": 1
 *    }
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 */

/**
 * @api {post} /puertas Crear una nueva puerta
 * @apiVersion 2.0.0
 * @apiGroup Puertas
 * @apiParam {String} nombre Nombre código de la puerta
 * @apiParam {Number} pin Pin del arduino de control al cual se conecta la puerta
 * @apiParam {Boolean} estadoInicial 1 si el estado inicial debe ser alto, 0 si el estado inicial debe ser bajo
 * @apiParam {Boolean} estadoActual 1 si se encuentra en estado alto, 0 si se encuentra en estado bajo
 * @apiParam {String} detalle Detalle o ubicación de la puerta
 * @apiParam {Number} arduinoControl Id del arduino de control que activa o desactiva esta puerta
 * @apiParamExample {json} Puerta
 *    {
 *      "nombre": "PNU",
 *      "pin": 10,
 *      "estadoInicial": true,
 *      "estadoActual": true,
 *      "detalle": "Puerta nueva",
 *      "arduinoControl": 1
 *    }
 * @apiSuccess {Number} id Id de la puerta
 * @apiSuccess {String} nombre Nombre código de la puerta
 * @apiSuccess {Number} pin Pin del arduino de control al cual se conecta la puerta
 * @apiSuccess {Boolean} estadoInicial 1 si el estado inicial debe ser alto, 0 si el estado inicial debe ser bajo
 * @apiSuccess {Boolean} estadoActual 1 si se encuentra en estado alto, 0 si se encuentra en estado bajo
 * @apiSuccess {String} detalle Detalle o ubicación de la puerta
 * @apiSuccess {Number} arduinoControl Id del arduino de control que activa o desactiva esta puerta
 * @apiSuccess {Date} createdAt Fecha de creación del registro
 * @apiSuccess {Date} updatedAt Fecha de alteración del registro
 * @apiSuccessExample {Object} Success
 *    HTTP/2 200 OK
 *    {
 *      "nombre": "PNU",
 *      "pin": 10,
 *      "estadoInicial": true,
 *      "estadoActual": true,
 *      "detalle": "Puerta nueva",
 *      "arduinoControl": 1
 *      "createdAt": "2017-01-01T00:00:00.000Z",
 *      "updatedAt": "2017-01-01T00:00:00.000Z"
 *    }
 * @apiError {json} 400 Consulta errónea
 *    HTTP/2 400
 *    {
 *      "message": "Validation error",
 *      "errors": [
 *        {
 *          "field": "PARÁMETRO",
 *          "message": "PARÁMETRO must be unique"
 *        }
 *      ]
 *    }
 * @apiError {json} 400 Consulta errónea
 *    HTTP/2 400
 *    {
 *      "message": "notNull Violation: PARÁMETRO cannot be null",
 *      "errors": [
 *        {
 *          "field": "PARÁMETRO",
 *          "message": "PARÁMETRO cannot be null"
 *        }
 *      ]
 *    }
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 */

/**
 * @api {put} /puertas/:id Actualizar una puerta
 * @apiVersion 2.0.0
 * @apiGroup Puertas
 * @apiParam {String} nombre Nombre código de la puerta
 * @apiParam {Number} pin Pin del arduino de control al cual se conecta la puerta
 * @apiParam {Boolean} estadoInicial 1 si el estado inicial debe ser alto, 0 si el estado inicial debe ser bajo
 * @apiParam {Boolean} estadoActual 1 si se encuentra en estado alto, 0 si se encuentra en estado bajo
 * @apiParam {String} detalle Detalle o ubicación de la puerta
 * @apiParam {Number} arduinoControl Id del arduino de control que activa o desactiva esta puerta
 * @apiParamExample {json} Puerta
 *    {
 *      "nombre": "PNU",
 *      "pin": 10,
 *      "estadoInicial": true,
 *      "estadoActual": true,
 *      "detalle": "Puerta nueva",
 *      "arduinoControl": 1
 *    }
 * @apiSuccess {Number} id Id de la puerta
 * @apiSuccess {String} nombre Nombre código de la puerta
 * @apiSuccess {Number} pin Pin del arduino de control al cual se conecta la puerta
 * @apiSuccess {Boolean} estadoInicial 1 si el estado inicial debe ser alto, 0 si el estado inicial debe ser bajo
 * @apiSuccess {Boolean} estadoActual 1 si se encuentra en estado alto, 0 si se encuentra en estado bajo
 * @apiSuccess {String} detalle Detalle o ubicación de la puerta
 * @apiSuccess {Number} arduinoControl Id del arduino de control que activa o desactiva esta puerta
 * @apiSuccess {Date} createdAt Fecha de creación del registro
 * @apiSuccess {Date} updatedAt Fecha de alteración del registro
 * @apiSuccessExample {Object} Success
 *    HTTP/2 200 OK
 *    {
 *      "id": 1,
 *      "nombre": "PNU",
 *      "pin": 10,
 *      "estadoInicial": true,
 *      "estadoActual": true,
 *      "detalle": "Puerta nueva",
 *      "arduinoControl": 1
 *      "createdAt": "2017-01-01T00:00:00.000Z",
 *      "updatedAt": "2017-01-02T00:00:00.000Z"
 *    }
 * @apiError {json} 400 Consulta errónea
 *    HTTP/2 400
 *    {
 *      "message": "Validation error",
 *      "errors": [
 *        {
 *          "field": "PARÁMETRO",
 *          "message": "PARÁMETRO must be unique"
 *        }
 *      ]
 *    }
 * @apiError {json} 400 Consulta errónea
 *    HTTP/2 400
 *    {
 *      "message": "notNull Violation: PARÁMETRO cannot be null",
 *      "errors": [
 *        {
 *          "field": "PARÁMETRO",
 *          "message": "PARÁMETRO cannot be null"
 *        }
 *      ]
 *    }
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 */

/**
 * @api {delete} /puertas/:id Eliminar una puerta
 * @apiVersion 2.0.0
 * @apiGroup Puertas
 * @apiSuccess {Object} Success Objeto vacío, elemento eliminado
 * @apiSuccessExample {Object} Success
 *    HTTP/2 200 OK
 *    {}
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 */

epilogue.resource({
  model: modelos.Puerta,
  endpoints: [`/v${cfg.apiAdmin.version}/puertas`, `/v${cfg.apiAdmin.version}/puertas/:id`],
  excludeAttributes: ['deletedAt'],
  include: [
    {
      model: modelos.Arduino,
      as: 'ArduinoControl'
    }
  ]
});

/**
 * @api {get} /arduinos Obtener la lista de arduinos
 * @apiVersion 2.0.0
 * @apiGroup Arduinos
 * @apiSuccess {Object[]} Lista Lista de arduinos
 * @apiSuccessExample {Object[]} Success
 *    HTTP/2 200 OK
 *    [
 *      {
 *        "id": 1,
 *        "mac": "AA:BB:CC:DD:EE:00",
 *        "ip": "192.168.1.100",
 *        "control": true,
 *        "detalle": "Arduino Control",
 *        "pinesSalida": [
 *          16,
 *          17
 *        ],
 *        "createdAt": "2017-01-01T00:00:00.000Z",
 *        "updatedAt": "2017-01-02T00:00:00.000Z",
 *        "clienteMqtt": 2,
 *        "puerta": null
 *      },
 *      {
 *        "id": 2,
 *        "mac": "AA:BB:CC:DD:EE:01",
 *        "ip": "192.168.1.101",
 *        "control": false,
 *        "detalle": "Arduino Interfaz Sensorial",
 *        "pinesSalida": null,
 *        "createdAt": "2017-01-01T00:00:00.000Z",
 *        "updatedAt": "2017-01-02T00:00:00.000Z",
 *        "clienteMqtt": 3,
 *        "puerta": 1
 *      }
 *    ]
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 */

/**
 * @api {get} /arduinos/:id Obtener los detalles de un arduino
 * @apiVersion 2.0.0
 * @apiGroup Arduinos
 * @apiSuccess {Number} id Id del arduino
 * @apiSuccess {String} mac Dirección de MAC de red del arduino
 * @apiSuccess {String} ip Dirección de IP de red del arduino
 * @apiSuccess {Boolean} control 1 si el arduino es de control, 0 si el arduino es una interfaz sensorial
 * @apiSuccess {String} detalle Nombre detallado o ubicación del arduino
 * @apiSuccess {Number[]} pinesSalida Si el arduino es de control se deben especificar todos los pines de salida
 * @apiSuccess {Number} clienteMqtt Id del cliente mqtt relacionado al arduino
 * @apiSuccess {Number} puerta Si el arduino es una interfaz sensorial se debe especificar la puerta relacionada
 * @apiSuccess {Date} createdAt Fecha de creación del registro
 * @apiSuccess {Date} updatedAt Fecha de alteración del registro
 * @apiSuccessExample {Object[]} Success
 *    HTTP/2 200 OK
 *    {
 *      "id": 2,
 *      "mac": "AA:BB:CC:DD:EE:01",
 *      "ip": "192.168.1.101",
 *      "control": false,
 *      "detalle": "Arduino Interfaz Sensorial",
 *      "pinesSalida": null,
 *      "createdAt": "2017-01-01T00:00:00.000Z",
 *      "updatedAt": "2017-01-02T00:00:00.000Z",
 *      "clienteMqtt": 3,
 *      "puerta": 1
 *    }
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 */

/**
 * @api {post} /arduinos Crear un nuevo arduino
 * @apiVersion 2.0.0
 * @apiGroup Arduinos
 * @apiParam {String} mac Dirección de MAC de red del arduino
 * @apiParam {String} ip Dirección de IP de red del arduino
 * @apiParam {Boolean} control 1 si el arduino es de control, 0 si el arduino es una interfaz sensorial
 * @apiParam {String} detalle Nombre detallado o ubicación del arduino
 * @apiParam {Number[]} pinesSalida Si el arduino es de control se deben especificar todos los pines de salida
 * @apiParam {Number} clienteMqtt Id del cliente mqtt relacionado al arduino
 * @apiParam {Number} puerta Si el arduino es una interfaz sensorial se debe especificar la puerta relacionada
 * @apiParamExample {Object[]} Arduino
 *    {
 *      "mac": "AA:BB:CC:DD:EE:01",
 *      "ip": "192.168.1.101",
 *      "control": false,
 *      "detalle": "Arduino Interfaz Sensorial",
 *      "pinesSalida": null,
 *      "clienteMqtt": 3,
 *      "puerta": 1
 *    }
 * @apiSuccess {Number} id Id del arduino
 * @apiSuccess {String} mac Dirección de MAC de red del arduino
 * @apiSuccess {String} ip Dirección de IP de red del arduino
 * @apiSuccess {Boolean} control 1 si el arduino es de control, 0 si el arduino es una interfaz sensorial
 * @apiSuccess {String} detalle Nombre detallado o ubicación del arduino
 * @apiSuccess {Number[]} pinesSalida Si el arduino es de control se deben especificar todos los pines de salida
 * @apiSuccess {Number} clienteMqtt Id del cliente mqtt relacionado al arduino
 * @apiSuccess {Number} puerta Si el arduino es una interfaz sensorial se debe especificar la puerta relacionada
 * @apiSuccess {Date} createdAt Fecha de creación del registro
 * @apiSuccess {Date} updatedAt Fecha de alteración del registro
 * @apiSuccessExample {Object[]} Success
 *    HTTP/2 200 OK
 *    {
 *      "id": 2,
 *      "mac": "AA:BB:CC:DD:EE:01",
 *      "ip": "192.168.1.101",
 *      "control": false,
 *      "detalle": "Arduino Interfaz Sensorial",
 *      "pinesSalida": null,
 *      "createdAt": "2017-01-01T00:00:00.000Z",
 *      "updatedAt": "2017-01-02T00:00:00.000Z",
 *      "clienteMqtt": 3,
 *      "puerta": 1
 *    }
 * @apiError {json} 400 Consulta errónea
 *    HTTP/2 400
 *    {
 *      "message": "Validation error",
 *      "errors": [
 *        {
 *          "field": "PARÁMETRO",
 *          "message": "PARÁMETRO must be unique"
 *        }
 *      ]
 *    }
 * @apiError {json} 400 Consulta errónea
 *    HTTP/2 400
 *    {
 *      "message": "notNull Violation: PARÁMETRO cannot be null",
 *      "errors": [
 *        {
 *          "field": "PARÁMETRO",
 *          "message": "PARÁMETRO cannot be null"
 *        }
 *      ]
 *    }
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 */

/**
 * @api {put} /arduinos/:id Actualizar un arduino
 * @apiVersion 2.0.0
 * @apiGroup Arduinos
 * @apiParam {String} mac Dirección de MAC de red del arduino
 * @apiParam {String} ip Dirección de IP de red del arduino
 * @apiParam {Boolean} control 1 si el arduino es de control, 0 si el arduino es una interfaz sensorial
 * @apiParam {String} detalle Nombre detallado o ubicación del arduino
 * @apiParam {Number[]} pinesSalida Si el arduino es de control se deben especificar todos los pines de salida
 * @apiParam {Number} clienteMqtt Id del cliente mqtt relacionado al arduino
 * @apiParam {Number} puerta Si el arduino es una interfaz sensorial se debe especificar la puerta relacionada
 * @apiParamExample {Object[]} Arduino
 *    {
 *      "mac": "AA:BB:CC:DD:EE:01",
 *      "ip": "192.168.1.101",
 *      "control": false,
 *      "detalle": "Arduino Interfaz Sensorial",
 *      "pinesSalida": null,
 *      "clienteMqtt": 3,
 *      "puerta": 1
 *    }
 * @apiSuccess {Number} id Id del arduino
 * @apiSuccess {String} mac Dirección de MAC de red del arduino
 * @apiSuccess {String} ip Dirección de IP de red del arduino
 * @apiSuccess {Boolean} control 1 si el arduino es de control, 0 si el arduino es una interfaz sensorial
 * @apiSuccess {String} detalle Nombre detallado o ubicación del arduino
 * @apiSuccess {Number[]} pinesSalida Si el arduino es de control se deben especificar todos los pines de salida
 * @apiSuccess {Number} clienteMqtt Id del cliente mqtt relacionado al arduino
 * @apiSuccess {Number} puerta Si el arduino es una interfaz sensorial se debe especificar la puerta relacionada
 * @apiSuccess {Date} createdAt Fecha de creación del registro
 * @apiSuccess {Date} updatedAt Fecha de alteración del registro
 * @apiSuccessExample {Object[]} Success
 *    HTTP/2 200 OK
 *    {
 *      "id": 2,
 *      "mac": "AA:BB:CC:DD:EE:01",
 *      "ip": "192.168.1.101",
 *      "control": false,
 *      "detalle": "Arduino Interfaz Sensorial",
 *      "pinesSalida": null,
 *      "createdAt": "2017-01-01T00:00:00.000Z",
 *      "updatedAt": "2017-01-02T00:00:00.000Z",
 *      "clienteMqtt": 3,
 *      "puerta": 1
 *    }
 * @apiError {json} 400 Consulta errónea
 *    HTTP/2 400
 *    {
 *      "message": "Validation error",
 *      "errors": [
 *        {
 *          "field": "PARÁMETRO",
 *          "message": "PARÁMETRO must be unique"
 *        }
 *      ]
 *    }
 * @apiError {json} 400 Consulta errónea
 *    HTTP/2 400
 *    {
 *      "message": "notNull Violation: PARÁMETRO cannot be null",
 *      "errors": [
 *        {
 *          "field": "PARÁMETRO",
 *          "message": "PARÁMETRO cannot be null"
 *        }
 *      ]
 *    }
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 */

/**
 * @api {delete} /arduinos/:id Eliminar un arduino
 * @apiVersion 2.0.0
 * @apiGroup Arduinos
 * @apiSuccess {Object} Success Objeto vacío, elemento eliminado
 * @apiSuccessExample {Object} Success
 *    HTTP/2 200 OK
 *    {}
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 */

epilogue.resource({
  model: modelos.Arduino,
  endpoints: [`/v${cfg.apiAdmin.version}/arduinos`, `/v${cfg.apiAdmin.version}/arduinos/:id`],
  excludeAttributes: ['deletedAt'],
  include: [
    {
      model: modelos.ClienteMqtt,
      attributes: ['id', 'usuario', 'conectado', 'updatedAt']
    }, {
      model: modelos.Puerta,
      as: 'PuertaSensor'
    }, {
      model: modelos.Puerta,
      as: 'PuertaControl'
    }
  ]
});

/**
 * @api {get} /permisosAcceso Obtener la lista de permisos de acceso
 * @apiVersion 2.0.0
 * @apiGroup PermisosAcceso
 * @apiSuccess {Object[]} Lista Lista de permisos de acceso
 * @apiSuccessExample {Object[]} Success
 *    HTTP/2 200 OK
 *    [
 *      {
 *        "id": 1,
 *        "fechaInicio": "2017-01-01T04:00:00.000Z",
 *        "fechaFin": null
 *        "Puerta": {
 *          "id": 1,
 *          "nombre": "P1",
 *          "pin": 0,
 *          "estadoInicial": true,
 *          "estadoActual": true,
 *          "detalle": "Puerta 1",
 *          "arduinoControl": 1
 *        },
 *        "Persona": {
 *          "id": 1,
 *          "nombre": "usuario1",
 *          "grabado": true
 *        }
 *      }, {
 *        "id": 2,
 *        "fechaInicio": "2017-01-01T04:00:00.000Z",
 *        "fechaFin": "2017-01-02T04:00:00.000Z",
 *        "Puerta": {
 *          "id": 2,
 *          "nombre": "P2",
 *          "pin": 1,
 *          "estadoInicial": true,
 *          "estadoActual": true,
 *          "detalle": "Puerta 2",
 *          "arduinoControl": 2
 *        },
 *        "Persona": {
 *          "id": 2,
 *          "nombre": "usuario2",
 *          "grabado": true
 *        }
 *      }
 *    ]
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 */

/**
 * @api {get} /permisosAcceso/:id Obtener los datos de un permiso de acceso
 * @apiVersion 2.0.0
 * @apiGroup PermisosAcceso
 * @apiSuccess {Number} id Id del permiso de acceso
 * @apiSuccess {Date} fechaInicio Fecha de inicio del permiso de acceso
 * @apiSuccess {Date} fechaFin Fecha final del permiso de acceso, NULL si el permiso es indefinido
 * @apiSuccess {Number} persona Id de la persona a la que se brinda el acceso
 * @apiSuccess {Number} puerta Id de la puerta a la que se brinda el acceso
 * @apiSuccessExample {Object[]} Success
 *    HTTP/2 200 OK
 *    {
 *      "id": 1,
 *      "fechaInicio": "2017-01-01T04:00:00.000Z",
 *      "fechaFin": null
 *      "Puerta": {
 *        "id": 1,
 *        "nombre": "P1",
 *        "pin": 0,
 *        "estadoInicial": true,
 *        "estadoActual": true,
 *        "detalle": "Puerta 1",
 *        "arduinoControl": 1
 *      },
 *      "Persona": {
 *        "id": 1,
 *        "nombre": "usuario1",
 *        "grabado": true
 *      }
 *    }
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 */

/**
 * @api {post} /permisosAcceso Crear un nuevo permiso de acceso
 * @apiVersion 2.0.0
 * @apiGroup PermisosAcceso
 * @apiSuccess {Date} fechaInicio Fecha de inicio del permiso de acceso
 * @apiSuccess {Date} fechaFin Fecha final del permiso de acceso, NULL si el permiso es indefinido
 * @apiSuccess {Number} persona Id de la persona a la que se brinda el acceso
 * @apiSuccess {Number} puerta Id de la puerta a la que se brinda el acceso
 * @apiParamExample {Object[]} PermisosAcceso
 *    {
 *      "fechaInicio": "2017-01-01T04:00:00.000Z",
 *      "fechaFin": "2017-01-02T04:00:00.000Z",
 *      "persona": 2,
 *      "puerta": 2
 *    }
 * @apiSuccess {Number} id Id del permiso de acceso
 * @apiSuccess {Date} fechaInicio Fecha de inicio del permiso de acceso
 * @apiSuccess {Date} fechaFin Fecha final del permiso de acceso, NULL si el permiso es indefinido
 * @apiSuccess {Number} persona Id de la persona a la que se brinda el acceso
 * @apiSuccess {Number} puerta Id de la puerta a la que se brinda el acceso
 * @apiSuccessExample {Object[]} Success
 *    HTTP/2 200 OK
 *    {
 *      "id": 2,
 *      "fechaInicio": "2017-01-01T04:00:00.000Z",
 *      "fechaFin": "2017-01-02T04:00:00.000Z",
 *      "persona": 2,
 *      "puerta": 2
 *    }
 * @apiError {json} 400 Consulta errónea
 *    HTTP/2 400
 *    {
 *      "message": "notNull Violation: PARÁMETRO cannot be null",
 *      "errors": [
 *        {
 *          "field": "PARÁMETRO",
 *          "message": "PARÁMETRO cannot be null"
 *        }
 *      ]
 *    }
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 */

/**
 * @api {put} /permisosAcceso/:id Actualizar un permiso de acceso
 * @apiVersion 2.0.0
 * @apiGroup PermisosAcceso
 * @apiSuccess {Date} fechaInicio Fecha de inicio del permiso de acceso
 * @apiSuccess {Date} fechaFin Fecha final del permiso de acceso, NULL si el permiso es indefinido
 * @apiSuccess {Number} persona Id de la persona a la que se brinda el acceso
 * @apiSuccess {Number} puerta Id de la puerta a la que se brinda el acceso
 * @apiParamExample {Object[]} PermisosAcceso
 *    {
 *      "fechaInicio": "2017-01-01T04:00:00.000Z",
 *      "fechaFin": "2017-01-02T04:00:00.000Z",
 *      "persona": 2,
 *      "puerta": 2
 *    }
 * @apiSuccess {Number} id Id del permiso de acceso
 * @apiSuccess {Date} fechaInicio Fecha de inicio del permiso de acceso
 * @apiSuccess {Date} fechaFin Fecha final del permiso de acceso, NULL si el permiso es indefinido
 * @apiSuccess {Number} persona Id de la persona a la que se brinda el acceso
 * @apiSuccess {Number} puerta Id de la puerta a la que se brinda el acceso
 * @apiSuccessExample {Object[]} Success
 *    HTTP/2 200 OK
 *    {
 *      "id": 2,
 *      "fechaInicio": "2017-01-01T04:00:00.000Z",
 *      "fechaFin": "2017-01-02T04:00:00.000Z",
 *      "persona": 2,
 *      "puerta": 2
 *    }
 * @apiError {json} 400 Consulta errónea
 *    HTTP/2 400
 *    {
 *      "message": "Validation error",
 *      "errors": [
 *        {
 *          "field": "PARÁMETRO",
 *          "message": "PARÁMETRO must be unique"
 *        }
 *      ]
 *    }
 * @apiError {json} 400 Consulta errónea
 *    HTTP/2 400
 *    {
 *      "message": "notNull Violation: PARÁMETRO cannot be null",
 *      "errors": [
 *        {
 *          "field": "PARÁMETRO",
 *          "message": "PARÁMETRO cannot be null"
 *        }
 *      ]
 *    }
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 */

/**
 * @api {delete} /permisosAcceso/:id Eliminar un permiso de acceso
 * @apiVersion 2.0.0
 * @apiGroup PermisosAcceso
 * @apiSuccess {Object} Success Objeto vacío, elemento eliminado
 * @apiSuccessExample {Object} Success
 *    HTTP/2 200 OK
 *    {}
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 */

epilogue.resource({
  model: modelos.PermisoAcceso,
  endpoints: [`/v${cfg.apiAdmin.version}/permisosAcceso`, `/v${cfg.apiAdmin.version}/permisosAcceso/:id`],
  excludeAttributes: ['deletedAt', 'persona', 'puerta'],
  include: [
    {
      model: modelos.Puerta,
      attributes: ['id', 'nombre', 'pin', 'estadoInicial', 'estadoActual', 'detalle', 'arduinoControl']
    }, {
      model: modelos.Persona,
      attributes: ['id', 'nombre', 'grabado']
    }
  ]
});

/**
 * @api {get} /personas Obtener la lista de personas
 * @apiVersion 2.0.0
 * @apiGroup Personas
 * @apiSuccess {Object[]} Lista Lista de personas
 * @apiSuccessExample {Object[]} Success
 *    HTTP/2 200 OK
 *    [
 *      {
 *        "id": 1,
 *        "nombre": "usuario1",
 *        "grabado": false,
 *        "createdAt": "2017-01-01T00:00:00.000Z",
 *        "updatedAt": "2017-01-01T00:00:00.000Z"
 *      },
 *      {
 *        "id": 2,
 *        "nombre": "usuario2",
 *        "grabado": true,
 *        "createdAt": "2017-01-01T00:00:00.000Z",
 *        "updatedAt": "2017-01-01T00:00:00.000Z"
 *      }
 *    ]
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 */

/**
 * @api {get} /personas/:id Obtener los datos de una persona en específico
 * @apiVersion 2.0.0
 * @apiGroup Personas
 * @apiSuccess {Number} id Id de la persona
 * @apiSuccess {Number} nombre Nombre de usuario de LDAP
 * @apiSuccess {Number} grabado 1 si la huella se há grabado en los sensores, 0 si la huella aún no se há grabado en los sensores
 * @apiSuccess {Date} createdAt Fecha de creación del registro
 * @apiSuccess {Date} updatedAt Fecha de alteración del registro
 * @apiSuccessExample {json} Success
 *    HTTP/2 200 OK
 *    {
 *      "id": 1,
 *      "nombre": "usuario1",
 *      "grabado": false,
 *      "createdAt": "2017-01-01T00:00:00.000Z",
 *      "updatedAt": "2017-01-01T00:00:00.000Z"
 *    }
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 */

epilogue.resource({
  model: modelos.Persona,
  endpoints: [`/v${cfg.apiAdmin.version}/personas`, `/v${cfg.apiAdmin.version}/personas/:id`],
  actions: ['list', 'read'],
  excludeAttributes: ['deletedAt']
});

/**
 * @api {get} /respuestas Obtener la lista de acciones y respuestas de los sensores
 * @apiVersion 2.0.0
 * @apiGroup Respuestas
 * @apiSuccess {Object[]} Lista Lista de acciones y respuestas
 * @apiSuccessExample {Object[]} Success
 *    HTTP/2 200 OK
 *    [
 *      {
 *        "id": 1,
 *        "comando": "Enviando huella 1",
 *        "respuesta": null,
 *        "createdAt": "2017-01-01T00:00:00.000Z",
 *        "updatedAt": "2017-01-01T00:00:00.000Z",
 *        "arduino": null
 *      },
 *      {
 *        "id": 2,
 *        "comando": null,
 *        "respuesta": "Proceso ejecutado con exito",
 *        "createdAt": "2017-01-01T00:00:00.000Z",
 *        "updatedAt": "2017-01-01T00:00:00.000Z",
 *        "arduino": 2
 *      }
 *    ]
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 */

/**
 * @api {get} /respuestas/:id Obtener los datos de una respuesta o acción específica
 * @apiVersion 2.0.0
 * @apiGroup Respuestas
 * @apiSuccess {Number} id Id de la acción o la respuesta
 * @apiSuccess {String} comando Comando enviado a los sensores, Null si se está recibiendo una respuesta
 * @apiSuccess {String} respuesta Respuesta recibida de los sensores, Null si se está enviando una acción
 * @apiSuccess {Number} arduino Id del arduino que responde, Null si se está enviando una acción
 * @apiSuccess {Date} createdAt Fecha de creación del registro
 * @apiSuccess {Date} updatedAt Fecha de alteración del registro
 * @apiSuccessExample {json} Success
 *    HTTP/2 200 OK
 *    {
 *      "id": 1,
 *      "comando": "Enviando huella 1",
 *      "respuesta": null,
 *      "createdAt": "2017-01-01T00:00:00.000Z",
 *      "updatedAt": "2017-01-01T00:00:00.000Z",
 *      "arduino": null
 *    }
 * @apiError {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 * @apiErrorExample {json} 401 No Autorizado
 *    HTTP/2 401
 *    {
 *      "code": "InvalidCredentials",
 *      "message": "No authorization token was found"
 *    }
 */

epilogue.resource({
  model: modelos.Respuesta,
  endpoints: [`/v${cfg.apiAdmin.version}/respuestas`, `/v${cfg.apiAdmin.version}/respuestas/:id`],
  actions: ['list', 'read'],
  excludeAttributes: ['deletedAt'],
  include: [
    {
      model: modelos.Arduino
    }
  ],
  search: [
    {
      param: 'fechaInicio',
      attributes: ['createdAt'],
      operator: '$gte'
    }, {
      param: 'fechaFin',
      attributes: ['createdAt'],
      operator: '$lte'
    }
  ]
});

app.listen(cfg.apiAdmin.puerto, () => {
  logger.info(`Servidor iniciado en https://${ip.obtenerIP()}:${cfg.apiAdmin.puerto}`);
});
