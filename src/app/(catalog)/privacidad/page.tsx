import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Qué datos guarda AltaEntrega, para qué los usa y cómo puedes consultarlos o borrarlos.",
};

// Responsable de los datos y correo de contacto (los piden Google Play y App Store).
const RESPONSABLE = "PENDIENTE: nombre del responsable";
const CONTACTO = "PENDIENTE@correo";
const ACTUALIZADA = "1 de octubre de 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function PrivacidadPage() {
  const correo = (
    <a href={`mailto:${CONTACTO}`} className="link">
      {CONTACTO}
    </a>
  );

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-8 text-sm leading-relaxed text-stone-700">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Política de privacidad</h1>
        <p className="mt-2 text-stone-500">Última actualización: {ACTUALIZADA}</p>
      </header>

      <p>
        AltaEntrega conecta a clientes con negocios y repartidores de Villa Altagracia, República Dominicana. Esta
        política explica qué datos guardamos, para qué los usamos y qué puedes hacer con ellos. Aplica a la web
        altaentrega.netlify.app y a las apps de Android y iPhone.
      </p>

      <Section title="Quién es responsable">
        <p>
          El responsable de tus datos es {RESPONSABLE}. Para cualquier pregunta sobre esta política o sobre tus datos,
          escribe a {correo}.
        </p>
      </Section>

      <Section title="Qué datos guardamos">
        <p>
          <strong>Todas las cuentas:</strong> nombre, correo electrónico, teléfono, contraseña (guardada cifrada; nadie
          puede leerla) y el tipo de cuenta (cliente, negocio o repartidor).
        </p>
        <p>
          <strong>Clientes:</strong> la dirección de entrega de cada pedido, los productos que pides, el total, el estado
          del pedido y, si pagas por transferencia, la foto del comprobante.
        </p>
        <p>
          <strong>Negocios:</strong> nombre, dirección, categoría y logo del negocio; los productos con sus fotos y
          precios; la cuenta bancaria donde recibe sus pagos (banco, tipo y número de cuenta, titular y cédula o RNC); y
          los comprobantes de pago de la suscripción.
        </p>
        <p>
          <strong>Repartidores:</strong> vehículo, número de cédula, matrícula, si está disponible para repartir, la
          cuenta bancaria donde recibe sus ganancias y los comprobantes de pago de la suscripción.
        </p>
        <p>
          No usamos tu ubicación GPS, no tenemos publicidad y no usamos herramientas de analítica que te sigan entre
          sitios.
        </p>
      </Section>

      <Section title="Para qué los usamos">
        <ul className="list-disc space-y-1 pl-5">
          <li>Crear tu cuenta y mantener tu sesión abierta.</li>
          <li>Recibir, preparar y entregar tus pedidos.</li>
          <li>Verificar a negocios y repartidores antes de aprobarlos.</li>
          <li>Confirmar pagos y transferencias, y pagar a negocios y repartidores lo que les corresponde.</li>
          <li>Cobrar las suscripciones de negocios y repartidores.</li>
          <li>Enviarte correos de la cuenta, como confirmar tu registro o recuperar tu contraseña.</li>
          <li>Cumplir obligaciones legales y contables, y prevenir fraudes.</li>
        </ul>
      </Section>

      <Section title="Quién ve tus datos">
        <p>
          <strong>Dentro de AltaEntrega:</strong> el negocio y el repartidor de un pedido ven tu nombre, tu teléfono y
          la dirección de entrega, solo para ese pedido. Tú ves el nombre, la dirección y el teléfono del negocio. El
          nombre, el logo, la dirección y los productos de los negocios aprobados son públicos en el catálogo.
        </p>
        <p>
          Los comprobantes de pago, las cuentas bancarias y la cédula no son públicos. Solo los ve el administrador de
          AltaEntrega para verificar pagos y cuentas.
        </p>
        <p>
          <strong>Proveedores:</strong> guardamos los datos en Supabase (base de datos, inicio de sesión y archivos) y
          la web está alojada en Netlify. Ellos tratan los datos solo para darnos ese servicio. Los pagos a negocios y
          repartidores pasan por sus bancos.
        </p>
        <p>
          <strong>No vendemos ni alquilamos tus datos</strong>, y no los compartimos con nadie más, salvo que una ley o
          una autoridad competente lo exija.
        </p>
      </Section>

      <Section title="Cookies y almacenamiento en tu dispositivo">
        <p>
          Usamos solo cookies necesarias para mantener tu sesión iniciada. El carrito se guarda en tu propio
          dispositivo hasta que haces el pedido. La web guarda una página para mostrarte un aviso cuando no tienes
          conexión. No usamos cookies de publicidad ni de seguimiento.
        </p>
      </Section>

      <Section title="Cuánto tiempo los guardamos">
        <p>
          Guardamos tus datos mientras tu cuenta esté activa. Los pedidos, pagos y comprobantes se conservan el tiempo
          que exijan las leyes contables y fiscales de la República Dominicana, aunque borres tu cuenta.
        </p>
      </Section>

      <Section title="Seguridad">
        <p>
          Toda la comunicación va cifrada (HTTPS). Cada persona solo puede leer los datos que le corresponden: las reglas
          de acceso se aplican en la propia base de datos, no solo en la pantalla. Las contraseñas se guardan cifradas.
        </p>
      </Section>

      <Section title="Tus derechos">
        <p>
          Según la Ley No. 172-13 de protección de datos personales de la República Dominicana, puedes pedir en
          cualquier momento:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Saber qué datos tuyos tenemos y recibir una copia.</li>
          <li>Corregir datos incorrectos o incompletos.</li>
          <li>Borrar tus datos, salvo los que la ley nos obliga a conservar.</li>
          <li>Oponerte a un uso concreto de tus datos.</li>
        </ul>
        <p>Escríbenos a {correo} desde el correo de tu cuenta. Te respondemos en un máximo de 30 días.</p>
      </Section>

      <Section title="Eliminar tu cuenta">
        <p>
          Para borrar tu cuenta, escribe a {correo} desde el correo de tu cuenta. Borramos tu perfil, tus datos de
          contacto, tus documentos y tus cuentas bancarias. Solo conservamos los pedidos y pagos que la ley nos obliga a
          guardar, sin usarlos para nada más.
        </p>
      </Section>

      <Section title="Menores de edad">
        <p>
          AltaEntrega no está dirigida a menores de 18 años. Si eres menor, usa la app con permiso y supervisión de tu
          madre, padre o tutor.
        </p>
      </Section>

      <Section title="Cambios en esta política">
        <p>
          Si cambiamos esta política, actualizaremos la fecha de arriba. Si el cambio es importante, te avisaremos por
          correo o dentro de la app.
        </p>
      </Section>
    </article>
  );
}
