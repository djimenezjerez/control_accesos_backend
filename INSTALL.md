# Sistema se seguridad de control de accesos mediante sensor biométrico de huella dactilar

### Requisitos

Para la instalación de este sistema es necesario un equipo con Linux Debian Jessie, conexión a un servidor de paquetes de Debian y tener disponible la comunicación con el segmento de red de los dispositivos controladores de hardware embebido de control de puertas, así como el de los dispositivos de interfaces biométricos ubicados en cada puerta.

Este proyecto levanta tres servicios, el primero es un servidor broker MQTT que recibe y/o retransmite los datos de los clientes autenticados y conectados, que en este caso serían los dispositivos de hardware específico desarrollados para este proyecto, conjuntamente se levanta una API REST que interactúa con el hardware para ordenar abrir puertas o grabar nuevas huellas, además de un monitor de cambios en la base de datos del Micro-Servicio de Usuarios para mantener sincronizada la tabla de usuarios con su relación de huellas y la tabla de usuarios con su relación de puertas.

El segundo servicio es una API de administración para interactuar con un cliente REST como el [cliente web](https://github.com/djimenezjerez/control_accesos_frontend) desarrollado para monitorear y administrar la base de datos de este servicio.

El tercero es un servicio que realiza respaldos de la base de datos de acuerdo a un tiempo determinado por el usuario.

Una dependencia obligatoria es la comunicación con el [Hardware registrador de huellas]( https://github.com/djimenezjerez/control_accesos_registrador), este hardware registra nuevas huellas de las personas disponibles en la lista de usuarios.

Para la funcionalidad del sistema se necesita el [Hardware Embebido Específico](https://github.com/djimenezjerez/control_accesos_hardware) de control central e interfaz de sensores biométricos apuntando a este servidor como broker MQTT.

### Pasos previos a la instalación de los servicios

* Definir las variables necesarias

```sh
export PROY_DIR="/opt/control_accesos/backend"
export VERSION_POSTGRES=9.6
export APP_DEPURACION=0
export IP_SERVIDOR="127.0.0.1"
export CERT_NOMBRE="api_control_accesos"
export CERT_DIR="certs"
export CERT_CLAVE=admin
export CERT_TAMANO=1024
export CERT_EXPIRACION=365
export CERT_DATOS="/C=BO/ST=La_Paz/L=LP/O=entidad/CN=empresa.com"
export ADMIN_USUARIO=admin
export ADMIN_CLAVE=admin
export API_ADMIN_SERVIDOR="localhost"
export API_ADMIN_PUERTO=3443
export API_ADMIN_VERSION=1
export API_SERVIDOR="localhost"
export API_PUERTO=3000
export API_VERSION=1
export PUERTA_LOGICA_ABIERTA=0
export PUERTA_TIEMPO_ABIERTA=6
export PUERTA_RETARDO_GRABACION_HUELLA=10
export SENSOR_CABECERA="ef01"
export SENSOR_DIRECCION="ffffffff"
export SENSOR_TAMANO_PAQUETE=128
export SENSOR_VELOCIDAD=57600
export SENSOR_LONGITUD_CLAVE=8
export MQTT_PUERTO=1883
export BASE_DATOS_TIPO="postgres"
export BASE_DATOS_SERVIDOR="localhost"
export BASE_DATOS_PUERTO=5432
export BASE_DATOS_USUARIO="postgres"
export BASE_DATOS_CLAVE=""
export BASE_DATOS_NOMBRE="control_accesos"
export MICROSERVICIO_PERSONAS_TIPO="postgres"
export MICROSERVICIO_PERSONAS_SERVIDOR="localhost"
export MICROSERVICIO_PERSONAS_PUERTO=5432
export MICROSERVICIO_PERSONAS_USUARIO="postgres"
export MICROSERVICIO_PERSONAS_CLAVE=""
export MICROSERVICIO_PERSONAS_NOMBRE="microservicio_personas"
export LDAP_SERVIDOR="ldap.empresa.com"
export LDAP_PUERTO=386
export LDAP_TLS=0
export LDAP_BASEDN="ou=usuarios,dc=empresa,dc=com"
export LDAP_IDENTIFICADOR="uid"
export BACKUP_RUTA="backup"
export BACKUP_NUMERO_RESPALDOS=12
export BACKUP_TAREA_CRON="0 0 0 * * 1"
export BACKUP_FORMATO_FECHA="DD-MM-YYYY"
export JWT_EXPIRACION="4h"
export JWT_ALGORITMO="RS256"
export SOCKET_PUERTO=4337
```

El significado de estas variables es el siguiente:

**PROY_DIR**=Directorio donde se irá a clonar el proyecto<br />
**VERSION_POSTGRES**=Versión de PostgreSQL a instalar<br />
**APP_DEPURACION**=Ver los mensajes de depuración para el desarrollo<br />
**IP_SERVIDOR**=Dirección IP del servidor donde se realiza la instalación<br />
**CERT_NOMBRE**=Nombre del archivo del certificado<br />
**CERT_DIR**=Directorio donde estarán contenidos los certificados<br />
**CERT_CLAVE**=Contraseña del certificado para abrir la API por SSL<br />
**CERT_TAMANO**=Tamaño del certificado en bytes<br />
**CERT_EXPIRACION**=Días de expiración del certificado<br />
**CERT_DATOS**=Datos necesarios para la creación del certificado<br />
**ADMIN_USUARIO**=Nombre de usuario para el administrador del sistema MQTT<br />
**ADMIN_CLAVE**=Contraseña del usuario administrador del sistema MQTT<br />
**API_ADMIN_SERVIDOR**=Servidor donde se halla escuchando la API de administración<br />
**API_ADMIN_PUERTO**=Puerto abierto para la API de administración<br />
**API_ADMIN_VERSION**=Versión de la API de administración<br />
**API_SERVIDOR**=Servidor donde se halla escuchando la API de interacción con el hardware<br />
**API_PUERTO**=Puerto abierto para la API de interacción con el hardware<br />
**API_VERSION**=Versión de la API de interacción con el hardware<br />
**PUERTA_LOGICA_ABIERTA**=Lógica para la apertura de las puertas<br />
**PUERTA_TIEMPO_ABIERTA**=Tiempo en segundos que se quedará abierta una puerta<br />
**PUERTA_RETARDO_GRABACION_HUELLA**=Tiempo en segundos para esperar entre el envío de lotes de datos a los **sensores**<br />
**SENSOR_CABECERA**=Cabecera de paquete de 2 bytes, por defecto 'ef01' definida de acuerdo al [manual del sensor biométrico](./doc/ZFM_user_manualV15.pdf)<br />
**SENSOR_DIRECCION**=Dirección de los sensores de 4 bytes, por defecto 'ffffffff' de acuerdo al [manual del sensor biométrico](./doc/ZFM_user_manualV15.pdf)<br />
**SENSOR_TAMANO_PAQUETE**=Tamaño de paquete recepción y transmisión, por defecto de 128 bytes de acuerdo al [manual del sensor biométrico](./doc/ZFM_user_manualV15.pdf)<br />
**SENSOR_VELOCIDAD**=Velocidad de transmisión de los sensores, por defecto 57600 de acuerdo al [manual del sensor biométrico](./doc/ZFM_user_manualV15.pdf)<br />
**SENSOR_LONGITUD_CLAVE**=Tamaño de la clave a generar para la autenticación MQTT de los dispositivod de hardware<br />
**MQTT_PUERTO**=Puerto donde escuchará el servidor MQTT<br />
**BASE_DATOS_TIPO**=Tipo de base de datos<br />
**BASE_DATOS_SERVIDOR**=Servidor de base de datos<br />
**BASE_DATOS_PUERTO**=Puerto del servicio de base de datos<br />
**BASE_DATOS_USUARIO**=Usuario de base de datos<br />
**BASE_DATOS_CLAVE**=Clave de usuario para la base de datos<br />
**BASE_DATOS_NOMBRE**=Nombre de base de datos<br />
**MICROSERVICIO_PERSONAS_TIPO**=Tipo de base de datos del microservicio<br />
**MICROSERVICIO_PERSONAS_SERVIDOR**=Servidor de base de datos del microservicio<br />
**MICROSERVICIO_PERSONAS_PUERTO**=Puerto de base de datos del microservicio<br />
**MICROSERVICIO_PERSONAS_USUARIO**=Usuario de base de datos del microservicio<br />
**MICROSERVICIO_PERSONAS_CLAVE**=Clave para el usuario de base de datos del microservicio<br />
**MICROSERVICIO_PERSONAS_NOMBRE**=Nombre de base de datos del microservicio<br />
**LDAP_SERVIDOR**=Nombre de servidor para autenticación por LDAP<br />
**LDAP_PUERTO**=Puerto de servidor para autenticación por LDAP<br />
**LDAP_TLS**=Habilitación de Seguridad en la Capa de Transporte del servidor LDAP<br />
**LDAP_BASEDN**=Base de búsqueda de usuarios en el servidor de LDAP<br />
**LDAP_IDENTIFICADOR**=Propiedad única de identificación de usuarios en el servidor LDAP<br />
**BACKUP_RUTA**=Carpeta donde se guardarán los backups de la base de datos<br />
**BACKUP_NUMERO_RESPALDOS**=Número límite de backups almacenados<br />
**BACKUP_TAREA_CRON**=Programación de tareas en formato [cron](https://www.npmjs.com/package/node-cron)<br />
**BACKUP_FORMATO_FECHA**=Formato de la fecha para los nombre de los archivos de backup<br />
**JWT_EXPIRACION**=Tiempo de expiración del token de acuerdo al [manual del proyecto jsonwebtoken de npm](https://github.com/auth0/node-jsonwebtoken)<br />
**JWT_ALGORITMO**=Algoritmo de encriptación para la firma del token de acuerdo al [manual del proyecto jsonwebtoken de npm](https://github.com/auth0/node-jsonwebtoken)<br />
**SOCKET_PUERTO**=Puerto para abrir los sockets de notificación de cambios en la base de datos

### Instalación de PostgreSQL

* De acuerdo a los datos definidos anteriormente se instalará y configurará una base de datos necesaria para el sistema

```sh
echo -e "deb http://apt.postgresql.org/pub/repos/apt/ jessie-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update
sudo apt install -y postgresql-$VERSION_POSTGRES
sudo -u postgres bash -c "psql -c \"CREATE USER ${BASE_DATOS_USUARIO} WITH PASSWORD "${BASE_DATOS_CLAVE}";\""
sudo -u postgres bash -c "psql -c \"CREATE DATABASE ${BASE_DATOS_NOMBRE} WITH OWNER ${BASE_DATOS_USUARIO};\""
sudo sed -ie "s@5432@""$BASE_DATOS_PUERTO""@" /etc/postgresql/$VERSION_POSTGRES/main/postgresql.conf
sudo systemctl restart postgresql
```

### Instalación de Node.js

* Se instalará el entorno de ejecución Javascript en el servidor

```sh
sudo apt install -y curl build-essential vim git openssl
git config --global http.sslVerify false
curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
sudo apt update &&\
sudo apt install -y nodejs
npm set strict-ssl false
npm config set registry http://registry.npmjs.org
```

### Instalación de los servicios

* Descarga del proyecto

```sh
sudo mkdir -p $PROY_DIR
sudo chown -R $USER:$USER $PROY_DIR
git clone https://github.com/djimenezjerez/control_accesos_backend.git "$PROY_DIR"
cd "$PROY_DIR"
npm install
sudo npm install -g zoo npm-run-all
```

* Parchar la libreria restify-acl

```sh
cp node_modules/restify-acl/lib/utils.js node_modules/restify-acl/lib/utils.js.bak
sed -i "s@.status(status)@@" node_modules/restify-acl/lib/utils.js
sed -i "s@(response)@(status, response)@" node_modules/restify-acl/lib/utils.js
sed -i "s@.send({@.send(status, {@" node_modules/restify-acl/lib/utils.js
```

* Creación del certificado para el cifrado de datos

```sh
mkdir "$PROY_DIR/certs"
cd "$PROY_DIR/certs"
openssl req -new -passout pass:$CERT_PASS -newkey rsa:$CERT_TAMANO -days $CERT_EXPIRACION -nodes -x509 -subj "${CERT_DATOS}" -keyout "${CERT_NOMBRE}.key" -out "${CERT_NOMBRE}.crt"
cd "$PROY_DIR"
```

* Creación de los archivos con las variables de entorno

```sh
cp datosInicialesBd.json.ejemplo datosInicialesBd.json
echo -e "PROY_DIR='${PROY_DIR}'\nAPP_DEPURACION=${APP_DEPURACION}\nCERT_NOMBRE='${CERT_NOMBRE}'\nCERT_DIR='${CERT_DIR}'\nAPI_ADMIN_SERVIDOR='${API_ADMIN_SERVIDOR}'\nAPI_ADMIN_PUERTO=${API_ADMIN_PUERTO}\nAPI_ADMIN_VERSION=${API_ADMIN_VERSION}\nAPI_SERVIDOR='${API_SERVIDOR}'\nAPI_PUERTO=${API_PUERTO}\nAPI_VERSION=${API_VERSION}\nPUERTA_LOGICA_ABIERTA=${PUERTA_LOGICA_ABIERTA}\nPUERTA_TIEMPO_ABIERTA=${PUERTA_TIEMPO_ABIERTA}\nPUERTA_RETARDO_GRABACION_HUELLA=${PUERTA_RETARDO_GRABACION_HUELLA}\nSENSOR_CABECERA='${SENSOR_CABECERA}'\nSENSOR_DIRECCION='${SENSOR_DIRECCION}'\nSENSOR_TAMANO_PAQUETE=${SENSOR_TAMANO_PAQUETE}\nSENSOR_VELOCIDAD=${SENSOR_VELOCIDAD}\nSENSOR_LONGITUD_CLAVE=${SENSOR_LONGITUD_CLAVE}\nMQTT_PUERTO=${MQTT_PUERTO}\nBASE_DATOS_TIPO='${BASE_DATOS_TIPO}'\nBASE_DATOS_SERVIDOR='${BASE_DATOS_SERVIDOR}'\nBASE_DATOS_PUERTO=${BASE_DATOS_PUERTO}\nBASE_DATOS_USUARIO='${BASE_DATOS_USUARIO}'\nBASE_DATOS_CLAVE='${BASE_DATOS_CLAVE}'\nBASE_DATOS_NOMBRE='${BASE_DATOS_NOMBRE}'\nMICROSERVICIO_PERSONAS_TIPO='${MICROSERVICIO_PERSONAS_TIPO}'\nMICROSERVICIO_PERSONAS_SERVIDOR='${MICROSERVICIO_PERSONAS_SERVIDOR}'\nMICROSERVICIO_PERSONAS_PUERTO=${MICROSERVICIO_PERSONAS_PUERTO}\nMICROSERVICIO_PERSONAS_USUARIO='${MICROSERVICIO_PERSONAS_USUARIO}'\nMICROSERVICIO_PERSONAS_CLAVE='${MICROSERVICIO_PERSONAS_CLAVE}'\nMICROSERVICIO_PERSONAS_NOMBRE='${MICROSERVICIO_PERSONAS_NOMBRE}'\nLDAP_SERVIDOR='${LDAP_SERVIDOR}'\nLDAP_PUERTO=${LDAP_PUERTO}\nLDAP_TLS=${LDAP_TLS}\nLDAP_BASEDN='${LDAP_BASEDN}'\nLDAP_IDENTIFICADOR='${LDAP_IDENTIFICADOR}'\nBACKUP_RUTA='${BACKUP_RUTA}'\nBACKUP_NUMERO_RESPALDOS=${BACKUP_NUMERO_RESPALDOS}\nBACKUP_TAREA_CRON='${BACKUP_TAREA_CRON}'\nBACKUP_FORMATO_FECHA='${BACKUP_FORMATO_FECHA}'\nJWT_EXPIRACION='${JWT_EXPIRACION}'\nJWT_ALGORITMO='${JWT_ALGORITMO}'\nSOCKET_PUERTO=${SOCKET_PUERTO}" | tee .env
sed -i "s@"usuario": "admin"@"usuario": """$ADMIN_USUARIO"""@" datosInicialesBd.json
sed -i "s@"usuario": "admin"@"usuario": """$ADMIN_CLAVE"""@" datosInicialesBd.json
```

* Instalación de la base de datos

```sh
npm run base_datos
```

### Demonizar los servicios

* Crear el demonio para el servicio de backups

```sh
export SERVICIO=backup_db
echo -e "[Service]\nWorkingDirectory=${PROY_DIR}\nExecStart=${PROY_DIR}/node_modules/zoo/bin/zoo --zoofile .env /usr/bin/node ${SERVICIO}/index.js\nRestart=always\nStandardOutput=syslog\nStandardError=syslog\nSyslogIdentifier=${SERVICIO}\nUser=${USER}\nEnvironment=NODE_ENV=production\n\n[Install]\nWantedBy=multi-user.target" | sudo tee -a /lib/systemd/system/$SERVICIO.service
sudo systemctl daemon-reload
sudo systemctl enable $SERVICIO
sudo systemctl start $SERVICIO
```

* Crear el demonio para la API de administración

```sh
export SERVICIO=api_admin
echo -e "[Service]\nWorkingDirectory=${PROY_DIR}\nExecStart=${PROY_DIR}/node_modules/zoo/bin/zoo --zoofile .env /usr/bin/node ${SERVICIO}/index.js\nRestart=always\nStandardOutput=syslog\nStandardError=syslog\nSyslogIdentifier=${SERVICIO}\nUser=${USER}\nEnvironment=NODE_ENV=production\n\n[Install]\nWantedBy=multi-user.target" | sudo tee -a /lib/systemd/system/$SERVICIO.service
sudo systemctl daemon-reload
sudo systemctl enable $SERVICIO
sudo systemctl start $SERVICIO
```

* Crear el demonio para el servidor MQTT y la API REST

```sh
export SERVICIO=mqtt_servidor
echo -e "[Service]\nWorkingDirectory=${PROY_DIR}\nExecStart=${PROY_DIR}/node_modules/zoo/bin/zoo --zoofile .env /usr/bin/node ${SERVICIO}/index.js\nRestart=always\nStandardOutput=syslog\nStandardError=syslog\nSyslogIdentifier=${SERVICIO}\nUser=${USER}\nEnvironment=NODE_ENV=production\n\n[Install]\nWantedBy=multi-user.target" | sudo tee -a /lib/systemd/system/$SERVICIO.service
sudo systemctl daemon-reload
sudo systemctl enable $SERVICIO
sudo systemctl start $SERVICIO
```

* En este punto los procesos ya se encuentran instalados y podemos comenzar a utilizar el sistema.

### Para continuar el desarrollo del proyecto o probarlo sin demonizar los procesos

* Generar la documentación

```sh
sudo npm install -g apidoc
cd "$PROY_DIR"
apidoc -e "(node_modules|public)" -i mqtt_servidor/api -o doc/api
apidoc -e "(node_modules|public|api)" -i mqtt_servidor -o doc/socket
apidoc -e "(node_modules|public)" -i api_admin -o doc/api_admin
mkdir /tmp/mqtt
cp mqtt_servidor/index.js /tmp/mqtt
apidoc -e "(node_modules|public)" -i /tmp/mqtt -o doc/mqtt
cd "$PROY_DIR"
```

* Correr los scripts de npm

```sh
sudo npm install -g mqtt light-server
NODE_ENV=dev npm run dev
NODE_ENV=dev npm start
```

* Para servir la documentación de la API de administración

```sh
cd "$PROY_DIR"
light-server -p 8001 -s doc
```

* Para revisar la documentación puede acceder a las siguientes rutas
- http://localhost:8001/api
- http://localhost:8001/api_admin
- http://localhost:8001/socket
- http://localhost:8001/mqtt

* Para realizar las consultas a la api del hardware se utiliza la siguiente ruta con los valores por defecto https://localhost:3000/v2/...

* Para realizar las consultas a la api de administración se utiliza la siguiente ruta con los valores por defecto https://localhost:3443/v2/...

* Para conectarse a las notificaciones mediante sockets se utiliza la siguiente ruta con los valores por defecto wss://localhost:4337

* Para conectarse al servidor MQTT se utiliza la siguiente ruta con los valores por defecto mqtt://localhost:1883

### Para realizar los tests

Existen dos tipos de tópicos en los que se envían mensajes hacia los sensores, los tópicos de control y los tópicos de órdenes, en los tópicos de control se envia el código gpio, con el id de un arduino, seguido de uno de sus pines gpio y como mensaje el estado 0 o 1 para apagar o encender dicho pin. El segundo tópico sirve para enviar directamente órdenes al sensor, estas funciones son las que se muestran en el [manual del sensor biométrico ZFM-20](./ZFM_user_manualV15.pdf).

* Verificar el envío de los datos de las huellas a los sensores

```sh
mqtt sub -v -h localhost -p 1883 -i admin -u admin -P admin -t c/0
```

* Verificar el envío de los datos de gpio para la apertura de puertas

```sh
mqtt sub -v -h localhost -p 1883 -i admin -u admin -P admin -t c/0
```

_Solo se puede realizar una de estas dos operaciones a la vez, ya que el sistema permite solo una conexión por usuario o cliente Mqtt._

* Para realizar los tests se debe tener una conexión establecida con la base de datos de huellas

```sh
NODE_ENV=dev npm test
```

*Mediante el comando de test y el monitoreo con el usuario admin (en caso de no haber cambiado el nombre por defecto) en el tópico c/0 se pueden observar las cadenas hexadecimales que serán enviadas a los sensores*
