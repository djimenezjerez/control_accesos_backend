#include <SPI.h>
#include <UIPEthernet.h>
#include <PubSubClient.h>
#include <avr/pgmspace.h>
#include <avr/wdt.h>
#define ledInfo 14
#define ledError 15

byte mac[] = {macRed};
IPAddress ip(ipArduino);

const char id[] PROGMEM = "usuarioMqtt";
const char usuario[] PROGMEM = "usuarioMqtt";
const char clave[] PROGMEM = "claveMqtt";
const char topicoComandoParticular[] PROGMEM = "c/arduinoId";
const char topicoRespuesta[] PROGMEM = "r/arduinoId";
const char topicoPuerta[] PROGMEM = "p/puertaId";
const char topicoComando[] PROGMEM = "c/0";

const char* const datos[] PROGMEM = {id, usuario, clave, topicoComando, topicoComandoParticular, topicoRespuesta, topicoPuerta};

IPAddress servidor(ipServidor);

char mem1[12];
char mem2[12];
char mem3[12];
char topicoPublicacion[6];

byte tamano = 12;
byte posicion = 9;

EthernetClient clienteEthernet;
PubSubClient mqtt(clienteEthernet);

byte hex2int(char* cadena, unsigned int inicio) {
  byte numeral = 0;
  byte decremento;
  for(byte i = 0; i < 2; i++) {
    if(cadena[inicio + i] <= 57) {
      decremento = 48;
    }
    else if(cadena[inicio + i] <= 70) {
      decremento = 55;
    }
    else {
      decremento = 87;
    }
    numeral += (cadena[i + inicio] - decremento) * (1 << (4 * (1 - i)));
  }
  return numeral;
}

String int2hex(byte dato) {
  String literal = "";
  literal[1] = ((dato & 0xF0) >> 4);
  if(literal[1] <= 9) {
    literal[1] += 48;
  }
  else {
    literal[1] += 55;
  }
  literal[2] = (dato & 0x0F);
  if(literal[2] <= 9) {
    literal[2] += 48;
  }
  else {
    literal[2] += 55;
  }
  return literal;
}

bool buscar = true;

void interrupcion(char* topico, byte* paquete, unsigned int tamanoPaquete) {
  if(tamanoPaquete == 1) {
    while(Serial.available()) {
      Serial.read();
    }
    String top = topico;
    if(top == String(strcpy_P(mem1, (char*)pgm_read_word(&(datos[3])))) || top == String(strcpy_P(mem1, (char*)pgm_read_word(&(datos[4]))))) {
      if((char)paquete[0] == '0') {
        buscar = false;
        strcpy_P(topicoPublicacion, (char*)pgm_read_word(&(datos[5])));
      }
      else {
        buscar = true;
        strcpy_P(topicoPublicacion, (char*)pgm_read_word(&(datos[6])));
      }
    }
  }
  else {
    int j;
    if(tamanoPaquete < 48) {
      tamano = hex2int((char*)paquete, 0);
      posicion = hex2int((char*)paquete, 2);
      j = 4;
    }
    else {
      j = 0;
    }
    for(int i = j; i < tamanoPaquete; i = i + 2) {
      Serial.write(hex2int((char*)paquete, i));
    }
  }
}

void reconectar() {
  while(!mqtt.connected()) {
    digitalWrite(ledError,HIGH);
    Ethernet.begin(mac, ip);
    delay(1500);
    digitalWrite(ledError,LOW);
    strcpy_P(mem1, (char*)pgm_read_word(&(datos[0])));
    strcpy_P(mem2, (char*)pgm_read_word(&(datos[1])));
    strcpy_P(mem3, (char*)pgm_read_word(&(datos[2])));
    if(mqtt.connect(mem1, mem2, mem3)) {
      strcpy_P(mem1, (char*)pgm_read_word(&(datos[3])));
      mqtt.subscribe(mem1);
      strcpy_P(mem1, (char*)pgm_read_word(&(datos[4])));
      mqtt.subscribe(mem1);
    }
    else {
      delay(1000);
    }
  }
}

void setup()
{
  wdt_disable();
  pinMode(ledInfo,OUTPUT);
  pinMode(ledError,OUTPUT);
  Serial.begin(57600);
  mqtt.setServer(servidor, 1883);
  mqtt.setCallback(interrupcion);
  strcpy_P(topicoPublicacion, (char*)pgm_read_word(&(datos[6])));
  wdt_enable(WDTO_8S);
}

void loop()
{
  if(!mqtt.loop()) {
    reconectar();
  }
  if(buscar) {
    wdt_reset();
    byte paquete[] = {0xef, 0x01, 0xff, 0xff, 0xff, 0xff, 0x01, 0x00, 0x03, 0x01, 0x00, 0x05};
    Serial.write(paquete, sizeof(paquete));
    while(Serial.available() < 12) {};
    for(byte i = 9; i > 0; i--) {
      Serial.read();
    }
    byte cmd = Serial.read();
    for(byte i = 2; i > 0; i--) {
      Serial.read();
    }
    if(cmd == 0x00) {
      digitalWrite(ledInfo,HIGH);
      byte paquete[] = {0xef, 0x01, 0xff, 0xff, 0xff, 0xff, 0x01, 0x00, 0x04, 0x02, 0x01, 0x00, 0x08};
      Serial.write(paquete, sizeof(paquete));
      while(Serial.available() < 12) {};
      for(byte i = 9; i > 0; i--) {
        Serial.read();
      }
      byte cmd = Serial.read();
      for(byte i = 2; i > 0; i--) {
        Serial.read();
      }
      if(cmd == 0x00) {
        byte paquete[] = {0xef, 0x01, 0xff, 0xff, 0xff, 0xff, 0x01, 0x00, 0x08, 0x04, 0x01, 0x00, 0x00, 0x03, 0xe8, 0x00, 0xf9};
        Serial.write(paquete, sizeof(paquete));
        while(Serial.available() < 16) {};
        for(byte i = 9; i > 0; i--) {
          Serial.read();
        }
        byte cmd = Serial.read();
        byte id1 = Serial.read();
        byte id0 = Serial.read();
        uint16_t id = id1;
        id = id << 8;
        id |= id0;
        for(byte i = 4; i > 0; i--) {
          Serial.read();
        }
        if(cmd == 0x00) {
          char str[4];
          sprintf(str, "%04x", id);
          mqtt.publish(topicoPublicacion, str);
        }
      }
      digitalWrite(ledInfo,LOW);
    }
  }
  else {
    wdt_reset();
    if(Serial.available() >= tamano) {
      for(byte i = posicion; i > 0; i--) {
        Serial.read();
      }
      byte res = Serial.read();
      for(byte i = (tamano - posicion - 1); i > 0; i--) {
        Serial.read();
      }
      char str[2];
      sprintf(str, "%02x", res);
      digitalWrite(ledInfo,HIGH);
      mqtt.publish(topicoPublicacion, str);
      digitalWrite(ledInfo,LOW);
    }
  }
}
