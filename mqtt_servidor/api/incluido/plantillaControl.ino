#include <SPI.h>
#include <UIPEthernet.h>
#include <PubSubClient.h>
#include <avr/pgmspace.h>
#include <avr/wdt.h>
#define ledInfo 14
#define ledError 15
#define estadoInicial estadoInicialPuertas

int salidas[] = {pinesSalidas};

byte mac[] = {macRed};
IPAddress ip(ipArduino);

const char id[] PROGMEM = "usuarioMqtt";
const char usuario[] PROGMEM = "usuarioMqtt";
const char clave[] PROGMEM = "claveMqtt";
const char topicoGpio[] PROGMEM = "gpioControl";

const char* const datos[] PROGMEM = {id, usuario, clave, topicoGpio};

IPAddress servidor(ipServidor);

char mem1[12];
char mem2[12];
char mem3[12];

EthernetClient clienteEthernet;
PubSubClient mqtt(clienteEthernet);

void interrupcion(char* topico, byte* paquete, unsigned int tamanoPaquete) {
  int i = atoi(&topico[posicionPin]);
  boolean estado;
  if((char)paquete[0] == '0') {
    estado = false;
  }
  else if((char)paquete[0] == '1') {
    estado = true;
  }
  digitalWrite(i, estado);
}

void reconectar() {
  while(!mqtt.connected()) {
    digitalWrite(ledError,HIGH);
    Ethernet.begin(mac, ip);
    digitalWrite(ledError,LOW);
    delay(1500);
    strcpy_P(mem1, (char*)pgm_read_word(&(datos[0])));
    strcpy_P(mem2, (char*)pgm_read_word(&(datos[1])));
    strcpy_P(mem3, (char*)pgm_read_word(&(datos[2])));
    if(mqtt.connect(mem1, mem2, mem3)) {
      for(int i = 0; i < sizeof(salidas); i++) {
        digitalWrite(salidas[i], estadoInicial);
      }
      strcpy_P(mem1, (char*)pgm_read_word(&(datos[3])));
      mqtt.subscribe(mem1);
    }
    else {
      delay(1000);
    }
  }
}

void setup() {
  wdt_disable();
  pinMode(ledInfo,OUTPUT);
  pinMode(ledError,OUTPUT);
  for(int i = 0; i < sizeof(salidas); i++) {
    pinMode(salidas[i], OUTPUT);
    digitalWrite(salidas[i], estadoInicial);
  }
  mqtt.setServer(servidor, 1883);
  mqtt.setCallback(interrupcion);
  wdt_enable(WDTO_8S);
}

void loop() {
  if(!mqtt.loop()) {
    reconectar();
  }
  else {
    digitalWrite(ledInfo,HIGH);
    wdt_reset();
    mqtt.loop();
    digitalWrite(ledInfo,LOW);
  }
}
