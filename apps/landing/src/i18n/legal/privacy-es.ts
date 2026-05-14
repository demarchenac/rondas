export const privacyEs = `
<h2>Tipos de Informacion Personal Recolectada</h2>
<p>La App recolecta los siguientes tipos de informacion dependiendo de las funciones utilizadas:</p>

<h3>Informacion de Cuenta</h3>
<p>Cuando inicias sesion a traves de WorkOS AuthKit (Email OTP, Apple o Google), se recolecta: direccion de correo electronico, nombre (si se proporciona), URL de avatar (si se proporciona), proveedor de autenticacion utilizado. Los datos de cuenta se almacenan en Convex, un servicio de base de datos en la nube.</p>

<h3>Datos de Recibos y Transacciones</h3>
<p>Cuando creas o escaneas cuentas: nombre de la cuenta, articulos, cantidades, precios, montos de impuestos y propinas, categoria/etiquetas de la cuenta, configuracion de moneda y pais.</p>

<h3>Informacion de Contactos</h3>
<p>La App accede a los contactos de tu dispositivo para asignar personas a los articulos de la cuenta. Los datos de contacto (nombre, numero de telefono, foto de perfil) se leen de tu dispositivo con tu permiso, se almacenan en Convex para habilitar la division y el compartir de cuentas, y nunca se venden ni se comparten con terceros.</p>

<h3>Datos de Ubicacion</h3>
<p>Con tu permiso: ubicacion GPS del dispositivo (para identificar donde se creo una cuenta), resuelta a un nombre de lugar mediante geocodificacion inversa.</p>

<h3>Fotos y Camara</h3>
<p>Con tu permiso: camara (para fotografiar recibos para escaneo con IA), biblioteca de fotos (para seleccionar fotos de recibos existentes), metadatos EXIF (fecha/hora) de fotos para marcas de tiempo de cuentas.</p>

<h3>Reportes de Errores y Fallos</h3>
<p>La App utiliza Sentry para monitoreo de errores, lo cual puede recolectar tipo de dispositivo, sistema operativo, version de la app, registros de fallos y direccion IP.</p>

<h3>Datos de Suscripcion</h3>
<p>La App utiliza RevenueCat para gestionar suscripciones, lo cual procesa recibos de compra, estado de suscripcion e identificadores anonimos de usuario.</p>

<h2>Uso de la Informacion Personal</h2>
<p>La informacion personal se utiliza para: proporcionar la funcionalidad principal (escaneo, division, compartir), autenticar tu cuenta, sincronizar datos entre dispositivos, generar resumenes para compartir por WhatsApp, procesar suscripciones, monitorear errores y mejorar la precision del escaneo con IA.</p>

<h2>Servicios de Terceros</h2>
<table>
<tr><th>Servicio</th><th>Proposito</th><th>Datos Procesados</th></tr>
<tr><td>Convex</td><td>Base de datos y backend</td><td>Cuenta, cuentas, contactos, etiquetas</td></tr>
<tr><td>WorkOS</td><td>Autenticacion</td><td>Email, nombre, tokens OAuth</td></tr>
<tr><td>Google Gemini</td><td>Escaneo de recibos con IA</td><td>Imagenes de recibos, articulos extraidos</td></tr>
<tr><td>RevenueCat</td><td>Suscripciones</td><td>Recibos de compra, derechos de acceso</td></tr>
<tr><td>Sentry</td><td>Monitoreo de errores</td><td>Registros de fallos, info del dispositivo, IP</td></tr>
<tr><td>Expo</td><td>Actualizaciones de la app (OTA)</td><td>Tipo de dispositivo, version de la app</td></tr>
</table>

<h2>Procesamiento de Recibos con IA</h2>
<p>Cuando escaneas un recibo, la imagen se envia a Google Gemini para procesamiento como datos base64. No se almacena permanentemente. Google no utiliza los datos de la API para entrenar sus modelos.</p>

<h2>Almacenamiento y Seguridad de Datos</h2>
<p>Todos los datos se almacenan en la infraestructura en la nube de Convex. La comunicacion esta cifrada mediante HTTPS/TLS. La autenticacion es gestionada por WorkOS con seguridad de nivel industrial.</p>

<h2>Derechos del Usuario</h2>
<p>Tienes derecho a: acceder a tus datos personales, corregir datos inexactos, eliminar tu cuenta y datos, exportar tus datos y oponerte a cierto procesamiento.</p>

<h3>Proteccion de Datos en Colombia (Ley 1581 de 2012)</h3>
<p>Si te encuentras en Colombia: derecho a conocer, actualizar y rectificar tus datos; derecho a solicitar prueba de consentimiento; derecho a revocar el consentimiento y solicitar la eliminacion; derecho a presentar quejas ante la Superintendencia de Industria y Comercio (SIC).</p>

<h3>GDPR (Espacio Economico Europeo)</h3>
<p>Si te encuentras en el EEE: derecho a la portabilidad de datos, restringir el procesamiento y presentar quejas ante tu autoridad local de proteccion de datos. Base legal: ejecucion de contrato, interes legitimo y consentimiento.</p>

<p>Para ejercer cualquier derecho, contactanos en <a href="mailto:legal@rondas.co">legal@rondas.co</a>.</p>

<h2>Privacidad de Menores</h2>
<p>La App no esta destinada a menores de 13 anos. No recolectamos informacion de menores de forma consciente.</p>

<h2>Contacto</h2>
<p>Email: <a href="mailto:legal@rondas.co">legal@rondas.co</a><br>Desarrollador: Cristhian De Marchena</p>
`;
