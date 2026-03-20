import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  BookOpen,
  Car,
  Users,
  ShoppingCart,
  Wallet,
  BarChart3,
  Settings,
  ClipboardCheck,
  Wrench,
  FileText,
  CreditCard,
  UserPlus,
  CalendarCheck,
  Store,
  Brain,
  Clock,
  ArrowLeftRight,
  History,
  ChevronRight,
  ChevronDown,
  Keyboard,
  Smartphone,
  HelpCircle,
  MessageCircle,
  ArrowLeft,
  Play,
  ExternalLink,
  Star,
  Zap,
  Shield,
  TrendingUp,
} from 'lucide-react'
import clsx from 'clsx'

// ── Manual sections data ──
// All content is static/hardcoded — no user input is rendered.

const SECTIONS = [
  {
    id: 'inicio',
    title: 'Primeros Pasos',
    icon: Star,
    color: 'primary',
    subsections: [
      {
        id: 'que-es',
        title: 'Que es Alfredo?',
        content: [
          { type: 'p', text: 'Alfredo es un sistema de gestion integral diseñado especificamente para agencias de autos en Argentina. Te permite controlar todo tu negocio desde un solo lugar:' },
          { type: 'list', items: [
            'Stock de vehiculos con precios, fotos y estado',
            'Operaciones de compra, venta y permuta',
            'Caja diaria con control de ingresos y egresos',
            'Clientes con historial completo',
            'Reportes de rentabilidad, stock aging y mas',
            'Peritajes con checklist detallado',
            'Cheques recibidos y emitidos',
          ]},
          { type: 'p', text: 'El sistema funciona desde cualquier dispositivo (PC, tablet, celular) y se puede instalar como aplicacion en tu telefono.' },
        ],
      },
      {
        id: 'acceso',
        title: 'Como acceder',
        content: [
          { type: 'steps', items: [
            'Ingresa a alfredoapp.com.ar desde cualquier navegador',
            'Inicia sesion con tu email y contraseña',
            'Si es tu primera vez, el administrador de tu agencia te dara las credenciales',
          ]},
          { type: 'tip', text: 'En el celular, podes instalar Alfredo como app. Cuando aparezca el banner de instalacion, toca "Instalar" y vas a tener acceso directo desde tu pantalla de inicio.' },
          { type: 'p', bold: 'Roles de usuario:' },
          { type: 'list', items: [
            'Admin: Acceso completo (caja, reportes, usuarios, configuracion)',
            'Vendedor: Acceso a stock, clientes, operaciones y gastos',
          ]},
        ],
      },
      {
        id: 'navegacion',
        title: 'Navegacion del sistema',
        content: [
          { type: 'p', bold: 'En escritorio (PC/notebook):' },
          { type: 'list', items: [
            'Barra lateral izquierda con todas las secciones',
            'Buscador rapido con Cmd+K (Mac) o Ctrl+K (Windows)',
            'Atajos de teclado para navegacion rapida',
          ]},
          { type: 'p', bold: 'En celular:' },
          { type: 'list', items: [
            'Menu hamburguesa arriba a la izquierda',
            'Barra inferior con accesos rapidos: Inicio, Stock, Gasto, Ventas, Caja',
            'Boton flotante de gasto rapido (el circular del medio)',
          ]},
          { type: 'p', bold: 'Atajos de teclado:' },
          { type: 'table', headers: ['Atajo', 'Accion'], rows: [
            ['Cmd/Ctrl + K', 'Buscar'],
            ['G + D', 'Ir al Dashboard'],
            ['G + S', 'Ir a Stock'],
            ['G + C', 'Ir a Clientes'],
            ['G + V', 'Ir a Ventas'],
            ['G + K', 'Ir a Caja'],
            ['G + R', 'Ir a Reportes'],
            ['N', 'Crear nuevo'],
            ['?', 'Ver todos los atajos'],
          ]},
        ],
      },
    ],
  },
  {
    id: 'stock',
    title: 'Stock de Unidades',
    icon: Car,
    color: 'blue',
    subsections: [
      {
        id: 'ver-stock',
        title: 'Ver el stock',
        content: [
          { type: 'p', text: 'En la seccion Stock ves todas las unidades de tu agencia con sus datos principales:' },
          { type: 'list', items: [
            'Filtros rapidos: Disponible, Reservado, Todos',
            'Busqueda: Por marca, modelo, dominio o cualquier campo',
            'Ordenamiento: Por fecha de ingreso, precio, antiguedad',
            'Vista: Tarjetas con foto, datos y precios',
          ]},
          { type: 'p', text: 'Cada tarjeta muestra:' },
          { type: 'list', items: [
            'Foto principal del vehiculo',
            'Marca, modelo, año y version',
            'Dominio y kilometraje',
            'Precio publicado y precio minimo',
            'Estado (badge de color)',
            'Dias en stock',
          ]},
        ],
      },
      {
        id: 'cargar-unidad',
        title: 'Cargar una unidad nueva',
        content: [
          { type: 'steps', items: [
            'Hace click en "+ Nueva Unidad" (o atajo N desde Stock)',
            'Completa los datos obligatorios: Marca, Modelo, Año, Version, Dominio (patente) y Kilometraje',
            'Carga los precios: Precio de compra (lo que pagaste), Precio publicado (precio de lista), Precio minimo (el minimo que aceptas)',
            'Datos opcionales: color, combustible, transmision, puertas, observaciones',
            'Guarda y listo — la unidad aparece como "Disponible"',
          ]},
          { type: 'tip', text: 'Despues de cargar la unidad podes subirle fotos y registrar gastos desde el detalle.' },
        ],
      },
      {
        id: 'detalle-unidad',
        title: 'Detalle de una unidad',
        content: [
          { type: 'p', text: 'Hace click en cualquier unidad para ver su ficha completa:' },
          { type: 'list', items: [
            'Informacion general: Todos los datos del vehiculo',
            'Precios: Compra, publicado, minimo y rentabilidad esperada',
            'Gastos: Lista de costos asociados (mecanico, pintura, gestoria, etc.)',
            'Fotos: Galeria de imagenes del vehiculo',
            'Historial: Movimientos y cambios de estado',
            'Compartir: Boton para compartir la ficha por WhatsApp o cualquier app',
          ]},
          { type: 'p', bold: 'Acciones disponibles:' },
          { type: 'list', items: [
            'Editar datos',
            'Cambiar estado (Disponible → Reservado → Vendido)',
            'Agregar gasto directo',
            'Iniciar operacion de venta',
          ]},
        ],
      },
      {
        id: 'estados',
        title: 'Estados de una unidad',
        content: [
          { type: 'p', text: 'Cada unidad tiene un estado que indica su situacion actual:' },
          { type: 'table', headers: ['Estado', 'Significado', 'Color'], rows: [
            ['Disponible', 'Lista para la venta', 'Verde'],
            ['Reservado', 'Señada o apartada por un cliente', 'Amarillo'],
            ['Vendido', 'Operacion de venta cerrada', 'Azul'],
          ]},
          { type: 'p', text: 'El estado cambia automaticamente cuando registras una operacion, o podes cambiarlo manualmente desde el detalle de la unidad.' },
        ],
      },
    ],
  },
  {
    id: 'peritajes',
    title: 'Peritajes',
    icon: ClipboardCheck,
    color: 'green',
    subsections: [
      {
        id: 'crear-peritaje',
        title: 'Crear un peritaje',
        content: [
          { type: 'p', text: 'El peritaje es una inspeccion detallada del vehiculo antes de la compra o como parte del control de calidad.' },
          { type: 'steps', items: [
            'Anda a Peritajes → "Nuevo Peritaje"',
            'Selecciona la unidad a peritar',
            'Completa el checklist por categorias: Motor (estado general, ruidos, perdidas), Carroceria (golpes, pintura, corrosion), Interior (tapizado, tablero, aire), Tren delantero/trasero (amortiguadores, rotulas), Neumaticos (estado y medidas), Electricidad (luces, levantavidrios)',
            'Agrega fotos de los puntos relevantes',
            'Escribi observaciones generales',
            'Guarda el peritaje',
          ]},
          { type: 'tip', text: 'Podes hacer peritajes desde el celular directamente en el taller, sacando fotos al momento.' },
        ],
      },
    ],
  },
  {
    id: 'clientes',
    title: 'Clientes',
    icon: Users,
    color: 'purple',
    subsections: [
      {
        id: 'gestion-clientes',
        title: 'Gestion de clientes',
        content: [
          { type: 'p', text: 'En Clientes tenes tu cartera completa:' },
          { type: 'list', items: [
            'Buscar: Por nombre, apellido, DNI/CUIT, telefono o email',
            'Crear cliente: Boton "+ Nuevo Cliente"',
            'Datos: Nombre, apellido, DNI/CUIT, telefono, email, direccion',
          ]},
          { type: 'p', text: 'Cada cliente tiene su ficha con:' },
          { type: 'list', items: [
            'Datos de contacto',
            'Historial de operaciones (compras y ventas)',
            'Notas y seguimiento',
          ]},
          { type: 'tip', text: 'Al crear una operacion de venta, si el cliente no existe podes crearlo en el momento.' },
        ],
      },
    ],
  },
  {
    id: 'interesados',
    title: 'Interesados',
    icon: UserPlus,
    color: 'pink',
    subsections: [
      {
        id: 'gestion-interesados',
        title: 'Registro de interesados',
        content: [
          { type: 'p', text: 'Los interesados son personas que buscan un vehiculo especifico pero no tenes en stock.' },
          { type: 'steps', items: [
            'Registra que buscan: marca, modelo, año, rango de precio',
            'Cuando ingresa una unidad que coincide, Alfredo te notifica automaticamente',
            'Podes contactarlos y cerrar la venta',
          ]},
          { type: 'p', bold: 'Ejemplo de flujo:' },
          { type: 'steps', items: [
            'Llega un cliente preguntando por un Corolla 2022',
            'No lo tenes → lo registras como interesado',
            'La semana siguiente ingresa un Corolla 2022 al stock',
            'Alfredo te avisa: "Hay un match con Juan Perez"',
            'Lo llamas, cierra la operacion',
          ]},
          { type: 'p', text: 'Es una herramienta clave para no perder oportunidades de venta.' },
        ],
      },
    ],
  },
  {
    id: 'operaciones',
    title: 'Ventas y Operaciones',
    icon: ShoppingCart,
    color: 'orange',
    subsections: [
      {
        id: 'tipos-operacion',
        title: 'Tipos de operacion',
        content: [
          { type: 'p', text: 'Alfredo maneja tres tipos de operaciones:' },
          { type: 'table', headers: ['Tipo', 'Descripcion'], rows: [
            ['Venta', 'Vendes un vehiculo a un cliente'],
            ['Compra', 'Compras un vehiculo de un proveedor o particular'],
            ['Permuta', 'Intercambias vehiculo + diferencia en dinero'],
          ]},
          { type: 'p', text: 'Cada operacion registra:' },
          { type: 'list', items: [
            'Unidad(es) involucrada(s)',
            'Cliente/proveedor',
            'Precio de la operacion',
            'Forma de pago (efectivo, transferencia, cheques)',
            'Rentabilidad calculada automaticamente',
          ]},
        ],
      },
      {
        id: 'registrar-venta',
        title: 'Registrar una venta',
        content: [
          { type: 'steps', items: [
            'Anda a Ventas → "Nueva Operacion"',
            'Selecciona tipo: Venta',
            'Elegi la unidad del stock',
            'Selecciona o crea el cliente',
            'Ingresa el precio de venta',
            'Detalla la forma de pago: Efectivo, Transferencia bancaria, Cheques (se registran individualmente), o combinacion de varios',
            'Agrega observaciones si es necesario',
            'Confirma la operacion',
          ]},
          { type: 'p', bold: 'Automaticamente:' },
          { type: 'list', items: [
            'La unidad pasa a estado "Vendido"',
            'Se registra el movimiento en Caja',
            'Se calcula la rentabilidad (precio venta - precio compra - gastos)',
            'Se actualiza el historial del cliente',
          ]},
        ],
      },
      {
        id: 'boleto',
        title: 'Boleto de compra-venta',
        content: [
          { type: 'p', text: 'Desde el detalle de una operacion podes generar el boleto de compra-venta con todos los datos legales:' },
          { type: 'list', items: [
            'Datos del comprador y vendedor',
            'Datos del vehiculo (marca, modelo, dominio, motor, chasis)',
            'Precio y forma de pago',
            'Garantia (configurable en Configuracion)',
            'Firmas',
          ]},
          { type: 'p', text: 'El boleto se genera en PDF listo para imprimir.' },
        ],
      },
    ],
  },
  {
    id: 'gastos',
    title: 'Gastos y Costos',
    icon: Wrench,
    color: 'amber',
    subsections: [
      {
        id: 'carga-rapida',
        title: 'Carga rapida de gastos',
        content: [
          { type: 'p', text: 'La seccion "Cargar Gasto" es el acceso mas rapido para registrar un gasto sobre una unidad:' },
          { type: 'steps', items: [
            'Selecciona la unidad (busqueda por marca/modelo/dominio)',
            'Elegi la categoria: Mecanica, Pintura/Chapa, Gestoria (transferencia, VTV, etc.), Limpieza/Estetica, Otros',
            'Ingresa el monto',
            'Opcionalmente: proveedor, descripcion, comprobante',
            'Guarda',
          ]},
          { type: 'p', text: 'El gasto se asocia a la unidad y se descuenta automaticamente de la rentabilidad esperada.' },
          { type: 'tip', text: 'En el celular, el boton circular del medio de la barra inferior es acceso directo a carga de gastos.' },
        ],
      },
      {
        id: 'gastos-mensuales',
        title: 'Gastos mensuales (Admin)',
        content: [
          { type: 'p', text: 'En Gastos del Mes el admin ve un resumen de todos los gastos del periodo:' },
          { type: 'list', items: [
            'Total gastado en el mes',
            'Desglose por categoria',
            'Desglose por unidad',
            'Comparativo con meses anteriores',
          ]},
          { type: 'p', text: 'Util para controlar los costos de preparacion y tener visibilidad del gasto total de la agencia.' },
        ],
      },
    ],
  },
  {
    id: 'caja',
    title: 'Caja Diaria',
    icon: Wallet,
    color: 'emerald',
    subsections: [
      {
        id: 'movimientos',
        title: 'Registro de movimientos',
        content: [
          { type: 'p', text: 'La Caja Diaria registra todo el flujo de dinero:' },
          { type: 'p', bold: 'Ingresos:' },
          { type: 'list', items: ['Cobros de ventas', 'Cobros de señas', 'Depositos de cheques', 'Otros ingresos'] },
          { type: 'p', bold: 'Egresos:' },
          { type: 'list', items: ['Pagos a proveedores', 'Gastos de unidades', 'Retiros', 'Gastos fijos'] },
          { type: 'p', text: 'Cada movimiento tiene: fecha, concepto, monto, medio de pago y referencia a la operacion/unidad si aplica.' },
        ],
      },
      {
        id: 'cierre-caja',
        title: 'Cierre de caja',
        content: [
          { type: 'p', text: 'Al final del dia, el admin puede hacer un cierre de caja:' },
          { type: 'steps', items: [
            'Revisa los movimientos del dia',
            'Verifica el saldo calculado vs el dinero fisico',
            'Si hay diferencia, registrala',
            'Confirma el cierre',
          ]},
          { type: 'p', text: 'El cierre queda como registro historico. Al dia siguiente arranca con el saldo anterior.' },
          { type: 'tip', text: 'Hace cierres todos los dias para tener un control preciso del dinero.' },
        ],
      },
    ],
  },
  {
    id: 'cheques',
    title: 'Cheques',
    icon: CreditCard,
    color: 'sky',
    subsections: [
      {
        id: 'gestion-cheques',
        title: 'Gestion de cheques',
        content: [
          { type: 'p', text: 'Control completo de cheques recibidos y emitidos:' },
          { type: 'p', bold: 'Cheques recibidos:' },
          { type: 'list', items: [
            'Fecha de emision y de cobro',
            'Banco y numero',
            'Monto',
            'Estado: En cartera, Depositado, Cobrado, Rechazado',
            'Cliente que lo entrego',
          ]},
          { type: 'p', bold: 'Cheques emitidos:' },
          { type: 'list', items: ['Datos del cheque', 'Beneficiario', 'Estado: Pendiente, Cobrado'] },
          { type: 'p', bold: 'Alertas:' },
          { type: 'p', text: 'El dashboard te avisa cuando hay cheques proximos a vencer para que los deposites a tiempo.' },
        ],
      },
    ],
  },
  {
    id: 'proveedores',
    title: 'Proveedores',
    icon: Store,
    color: 'indigo',
    subsections: [
      {
        id: 'gestion-proveedores',
        title: 'Gestion de proveedores',
        content: [
          { type: 'p', text: 'Registra tus proveedores habituales:' },
          { type: 'list', items: [
            'Mecanicos: Talleres de confianza',
            'Chapistas/Pintores: Para reparaciones de carroceria',
            'Gestorias: Para tramites de transferencia, VTV, etc.',
            'Otros: Limpieza, accesorios, repuestos',
          ]},
          { type: 'p', text: 'Cada proveedor tiene: nombre, CUIT, telefono, email, direccion y rubro.' },
          { type: 'p', text: 'Al cargar un gasto podes asociarlo a un proveedor, lo que te permite despues ver cuanto le pagaste a cada uno en un periodo.' },
        ],
      },
    ],
  },
  {
    id: 'reportes',
    title: 'Reportes y Analisis',
    icon: BarChart3,
    color: 'violet',
    subsections: [
      {
        id: 'dashboard-kpis',
        title: 'Dashboard y KPIs',
        content: [
          { type: 'p', text: 'El Dashboard muestra los indicadores clave:' },
          { type: 'list', items: [
            'Unidades en stock: Cantidad y valor total',
            'Operaciones del mes: Ventas, compras, monto total',
            'Rentabilidad del mes: Ganancia neta',
            'Alertas activas: Cheques por cobrar, stock inmovilizado',
          ]},
          { type: 'p', text: 'Todo se actualiza en tiempo real al registrar operaciones y movimientos.' },
        ],
      },
      {
        id: 'inteligencia',
        title: 'Inteligencia de negocio',
        content: [
          { type: 'p', text: 'La seccion Inteligencia es exclusiva para admins y ofrece analisis avanzados:' },
          { type: 'list', items: [
            'Sugerencias de repricing: Unidades que llevan muchos dias y convendria bajar el precio',
            'Costo de oportunidad: Cuanto te cuesta tener el capital inmovilizado en una unidad',
            'Margen por categoria: Que tipo de vehiculos te dejan mas margen',
          ]},
          { type: 'p', text: 'Los parametros son configurables (tasa de oportunidad, dias de alerta, etc.).' },
        ],
      },
      {
        id: 'rentabilidad',
        title: 'Rentabilidad por vendedor',
        content: [
          { type: 'p', text: 'Reporte que muestra el desempeño de cada vendedor:' },
          { type: 'list', items: [
            'Cantidad de operaciones',
            'Monto total vendido',
            'Rentabilidad generada',
            'Ticket promedio',
            'Ranking',
          ]},
          { type: 'p', text: 'Util para definir comisiones y evaluar rendimiento del equipo.' },
        ],
      },
      {
        id: 'stock-aging',
        title: 'Antiguedad de stock',
        content: [
          { type: 'p', text: 'Muestra las unidades ordenadas por dias en stock:' },
          { type: 'list', items: [
            '0-30 dias: Stock fresco (verde)',
            '31-60 dias: Atencion (amarillo)',
            '60+ dias: Inmovilizado (rojo)',
          ]},
          { type: 'p', text: 'Para cada unidad muestra la rentabilidad esperada y el costo de oportunidad acumulado. Te ayuda a tomar decisiones de repricing.' },
        ],
      },
      {
        id: 'comparativo',
        title: 'Comparativo mensual',
        content: [
          { type: 'p', text: 'Compara metricas entre meses:' },
          { type: 'list', items: [
            'Operaciones cerradas',
            'Ingresos y egresos',
            'Rentabilidad neta',
            'Stock promedio',
          ]},
          { type: 'p', text: 'Con graficos de evolucion para ver tendencias del negocio.' },
        ],
      },
    ],
  },
  {
    id: 'agenda',
    title: 'Agenda',
    icon: CalendarCheck,
    color: 'teal',
    subsections: [
      {
        id: 'seguimientos',
        title: 'Seguimientos y recordatorios',
        content: [
          { type: 'p', text: 'La Agenda centraliza todos tus compromisos:' },
          { type: 'list', items: [
            'Seguimientos de clientes: "Llamar a Juan el martes para ver si cierra"',
            'Vencimientos: VTV, seguros, cheques por cobrar',
            'Tareas pendientes: Documentacion, tramites',
          ]},
          { type: 'p', text: 'Podes crear seguimientos desde:' },
          { type: 'list', items: [
            'El detalle de un cliente',
            'El detalle de una unidad',
            'Directamente desde la Agenda',
          ]},
          { type: 'p', text: 'Alfredo te muestra las tareas del dia y las proximas pendientes.' },
        ],
      },
    ],
  },
  {
    id: 'configuracion',
    title: 'Configuracion',
    icon: Settings,
    color: 'gray',
    subsections: [
      {
        id: 'usuarios',
        title: 'Gestion de usuarios',
        content: [
          { type: 'p', text: 'El admin puede crear y gestionar usuarios:' },
          { type: 'steps', items: [
            'Anda a Usuarios → "Nuevo Usuario"',
            'Ingresa: nombre, apellido, email, contraseña',
            'Asigna el rol: Admin o Vendedor',
            'El usuario ya puede ingresar al sistema',
          ]},
          { type: 'p', bold: 'Permisos por rol:' },
          { type: 'table', headers: ['Funcion', 'Admin', 'Vendedor'], rows: [
            ['Ver stock', 'Si', 'Si'],
            ['Cargar unidades', 'Si', 'Si'],
            ['Cargar gastos', 'Si', 'Si'],
            ['Ver clientes', 'Si', 'Si'],
            ['Registrar ventas', 'Si', 'Si'],
            ['Caja diaria', 'Si', 'No'],
            ['Cheques', 'Si', 'No'],
            ['Reportes', 'Si', 'No'],
            ['Usuarios', 'Si', 'No'],
            ['Facturacion', 'Si', 'No'],
          ]},
        ],
      },
      {
        id: 'facturacion',
        title: 'Facturacion y plan',
        content: [
          { type: 'p', text: 'En Facturacion gestionas tu suscripcion:' },
          { type: 'list', items: [
            'Ver tu plan actual (Trial, Basico, Profesional, Premium)',
            'Dias restantes del trial',
            'Actualizar plan',
            'Metodo de pago (MercadoPago)',
            'Historial de pagos',
          ]},
          { type: 'p', bold: 'Planes:' },
          { type: 'list', items: [
            'Trial: 14 dias gratis con todas las funciones',
            'Basico: Funciones esenciales',
            'Profesional: Todo incluido + reportes avanzados',
            'Premium: Todo + soporte prioritario + integraciones',
          ]},
        ],
      },
      {
        id: 'perfil',
        title: 'Mi perfil',
        content: [
          { type: 'p', text: 'Desde Mi Perfil podes:' },
          { type: 'list', items: [
            'Ver y editar tus datos personales',
            'Cambiar tu contraseña',
            'Ver tu rol y permisos',
          ]},
        ],
      },
    ],
  },
  {
    id: 'mobile',
    title: 'Uso en celular',
    icon: Smartphone,
    color: 'rose',
    subsections: [
      {
        id: 'instalar',
        title: 'Instalar la app',
        content: [
          { type: 'p', text: 'Alfredo se puede instalar como aplicacion en tu celular:' },
          { type: 'p', bold: 'En Android (Chrome):' },
          { type: 'steps', items: [
            'Abri alfredoapp.com.ar en Chrome',
            'Cuando aparezca el banner "Instalar Alfredo", toca Instalar',
            '(O usa el menu de Chrome → "Agregar a pantalla de inicio")',
            'Listo! Tenes el icono en tu pantalla',
          ]},
          { type: 'p', bold: 'En iPhone (Safari):' },
          { type: 'steps', items: [
            'Abri alfredoapp.com.ar en Safari',
            'Toca el boton de Compartir (cuadrado con flecha)',
            'Selecciona "Agregar a pantalla de inicio"',
            'Confirma tocando "Agregar"',
          ]},
          { type: 'p', bold: 'Ventajas de instalar:' },
          { type: 'list', items: [
            'Acceso directo sin abrir el navegador',
            'Pantalla completa sin barra de direccion',
            'Accesos rapidos con long-press en el icono (Android)',
            'Funciona offline con los datos en cache',
          ]},
        ],
      },
      {
        id: 'tips-mobile',
        title: 'Tips para mobile',
        content: [
          { type: 'list', items: [
            'Barra inferior: Los 5 accesos mas usados siempre a mano',
            'Boton de gasto: El boton circular del centro es para cargar gastos rapidamente',
            'Deslizar: En listas, podes hacer scroll horizontal para ver mas columnas',
            'Busqueda: El icono de lupa arriba a la derecha abre la busqueda global',
            'Modo oscuro: Toca el icono de sol/luna en el header para cambiar el tema',
            'Offline: Si perdes conexion, vas a ver un banner amarillo. Los datos se cargan desde cache pero no se pueden guardar cambios hasta que vuelva la conexion.',
          ]},
        ],
      },
    ],
  },
  {
    id: 'soporte',
    title: 'Soporte',
    icon: HelpCircle,
    color: 'cyan',
    subsections: [
      {
        id: 'contacto',
        title: 'Contacto y ayuda',
        content: [
          { type: 'p', bold: 'WhatsApp: +54 351 856-7543' },
          { type: 'p', bold: 'Horarios de atencion:' },
          { type: 'list', items: [
            'Lunes a Viernes: 9:00 a 18:00',
            'Sabados: 9:00 a 13:00',
          ]},
          { type: 'p', bold: 'Tipos de consultas:' },
          { type: 'list', items: [
            'Dudas sobre el uso del sistema',
            'Reportar errores o problemas',
            'Solicitar funciones nuevas',
            'Consultas sobre planes y facturacion',
          ]},
          { type: 'tip', text: 'Si reportas un error, inclui una captura de pantalla y los pasos para reproducirlo.' },
        ],
      },
      {
        id: 'faq',
        title: 'Preguntas frecuentes',
        content: [
          { type: 'faq', question: 'Puedo usar Alfredo en mas de un dispositivo?', answer: 'Si, tu cuenta funciona en todos los dispositivos. Los datos se sincronizan en tiempo real.' },
          { type: 'faq', question: 'Que pasa si se me termina el trial?', answer: 'Podes seguir accediendo pero con funciones limitadas. Actualiza tu plan desde Facturacion para desbloquear todo.' },
          { type: 'faq', question: 'Puedo exportar datos a Excel?', answer: 'Si, las tablas de stock, clientes y reportes tienen boton de exportar a Excel.' },
          { type: 'faq', question: 'Como agrego fotos a una unidad?', answer: 'Desde el detalle de la unidad, seccion "Fotos". Podes subir multiples imagenes.' },
          { type: 'faq', question: 'Como elimino una unidad?', answer: 'No se eliminan para mantener la trazabilidad. Podes cambiar su estado a "Vendido" o marcarla como baja.' },
          { type: 'faq', question: 'Puedo tener mas de un usuario admin?', answer: 'Si, podes asignar rol Admin a varios usuarios.' },
          { type: 'faq', question: 'Los datos son seguros?', answer: 'Si. Usamos encriptacion SSL, base de datos aislada por agencia (multi-tenant), y backups automaticos diarios.' },
        ],
      },
    ],
  },
]

const colorMap = {
  primary: 'bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400',
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
  green: 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400',
  purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400',
  pink: 'bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-400',
  orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400',
  indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400',
  violet: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400',
  teal: 'bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400',
  gray: 'bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-400',
  rose: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400',
  cyan: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400',
}

// ── Structured content renderer (no dangerouslySetInnerHTML) ──

function RenderContent({ blocks }) {
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'p':
            return (
              <p key={i} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {block.bold && <strong className="font-semibold text-gray-900 dark:text-white">{block.bold} </strong>}
                {block.text}
              </p>
            )

          case 'list':
            return (
              <ul key={i} className="space-y-1.5 my-2">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="text-primary-500 mt-0.5 flex-shrink-0">&#8226;</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )

          case 'steps':
            return (
              <div key={i} className="space-y-2 my-3">
                {block.items.map((item, j) => (
                  <div key={j} className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {j + 1}
                    </span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{item}</span>
                  </div>
                ))}
              </div>
            )

          case 'tip':
            return (
              <div key={i} className="my-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  <strong className="font-semibold">Tip: </strong>{block.text}
                </p>
              </div>
            )

          case 'table':
            return (
              <div key={i} className="my-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      {block.headers.map((h, hi) => (
                        <th key={hi} className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-gray-100 dark:border-gray-800">
                        {row.map((cell, ci) => (
                          <td key={ci} className="py-2 px-3 text-gray-600 dark:text-gray-400">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )

          case 'faq':
            return (
              <div key={i} className="mb-4">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                  P: {block.question}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 pl-4 border-l-2 border-primary-200 dark:border-primary-700">
                  {block.answer}
                </p>
              </div>
            )

          default:
            return null
        }
      })}
    </div>
  )
}


// ── Manual Page Component ──

export default function Manual() {
  const [activeSection, setActiveSection] = useState('inicio')
  const [activeSubsection, setActiveSubsection] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const contentRef = useRef(null)

  // Set first subsection when section changes
  useEffect(() => {
    const section = SECTIONS.find(s => s.id === activeSection)
    if (section?.subsections.length) {
      setActiveSubsection(section.subsections[0].id)
    }
  }, [activeSection])

  // Filter sections by search
  const filteredSections = searchQuery.trim()
    ? SECTIONS.map(section => ({
        ...section,
        subsections: section.subsections.filter(sub =>
          sub.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          JSON.stringify(sub.content).toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(s => s.subsections.length > 0)
    : SECTIONS

  const currentSection = SECTIONS.find(s => s.id === activeSection)
  const currentSubsection = currentSection?.subsections.find(s => s.id === activeSubsection)

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-primary-100 dark:bg-primary-900/40">
            <BookOpen className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manual de Uso</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Guia completa de Alfredo</p>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar - Table of Contents */}
        <aside className={clsx(
          'w-72 flex-shrink-0',
          'fixed inset-0 z-50 lg:relative lg:z-auto',
          mobileSidebarOpen ? 'block' : 'hidden lg:block'
        )}>
          {mobileSidebarOpen && (
            <div
              className="fixed inset-0 bg-gray-900/50 lg:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
          )}

          <div className={clsx(
            'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden',
            'lg:sticky lg:top-8',
            mobileSidebarOpen && 'fixed top-4 left-4 right-4 bottom-4 z-50 lg:relative lg:top-auto lg:left-auto lg:right-auto lg:bottom-auto'
          )}>
            {/* Search */}
            <div className="p-3 border-b border-gray-100 dark:border-gray-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar en el manual..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white placeholder-gray-400"
                />
              </div>
            </div>

            {/* Sections list */}
            <div className="overflow-y-auto max-h-[70vh] p-2 scrollbar-thin">
              {filteredSections.map(section => {
                const Icon = section.icon
                const isActive = activeSection === section.id && !searchQuery
                return (
                  <div key={section.id} className="mb-1">
                    <button
                      onClick={() => {
                        setActiveSection(section.id)
                        setSearchQuery('')
                        setMobileSidebarOpen(false)
                      }}
                      className={clsx(
                        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors text-sm',
                        isActive
                          ? 'bg-primary-50 text-primary-700 font-medium dark:bg-primary-950 dark:text-primary-400'
                          : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
                      )}
                    >
                      <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', colorMap[section.color])}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="truncate">{section.title}</span>
                    </button>

                    {isActive && section.subsections.length > 1 && (
                      <div className="ml-10 mt-1 space-y-0.5">
                        {section.subsections.map(sub => (
                          <button
                            key={sub.id}
                            onClick={() => {
                              setActiveSubsection(sub.id)
                              setMobileSidebarOpen(false)
                            }}
                            className={clsx(
                              'w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors',
                              activeSubsection === sub.id
                                ? 'text-primary-600 dark:text-primary-400 font-medium bg-primary-50/50 dark:bg-primary-950/50'
                                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            )}
                          >
                            {sub.title}
                          </button>
                        ))}
                      </div>
                    )}

                    {searchQuery && section.subsections.map(sub => (
                      <button
                        key={sub.id}
                        onClick={() => {
                          setActiveSection(section.id)
                          setActiveSubsection(sub.id)
                          setSearchQuery('')
                          setMobileSidebarOpen(false)
                        }}
                        className="w-full text-left ml-10 px-3 py-1.5 text-xs text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                      >
                        {sub.title}
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </aside>

        {/* Mobile TOC toggle */}
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="lg:hidden fixed bottom-20 right-4 z-40 p-3 bg-primary-600 text-white rounded-full shadow-lg shadow-primary-500/30"
        >
          <BookOpen className="w-5 h-5" />
        </button>

        {/* Content area */}
        <div className="flex-1 min-w-0" ref={contentRef}>
          {currentSection && (
            <div className="card-static">
              {/* Section header */}
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
                <div className={clsx('p-3 rounded-xl', colorMap[currentSection.color])}>
                  <currentSection.icon className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{currentSection.title}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {currentSection.subsections.length} {currentSection.subsections.length === 1 ? 'tema' : 'temas'}
                  </p>
                </div>
              </div>

              {/* Subsection tabs */}
              {currentSection.subsections.length > 1 && (
                <div className="flex gap-1 mb-6 overflow-x-auto pb-1 scrollbar-thin">
                  {currentSection.subsections.map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => setActiveSubsection(sub.id)}
                      className={clsx(
                        'px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors',
                        activeSubsection === sub.id
                          ? 'bg-primary-50 text-primary-700 font-medium dark:bg-primary-950 dark:text-primary-400'
                          : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-400'
                      )}
                    >
                      {sub.title}
                    </button>
                  ))}
                </div>
              )}

              {/* Content */}
              {currentSubsection && (
                <div className="animate-page-in">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {currentSubsection.title}
                  </h3>
                  <RenderContent blocks={currentSubsection.content} />
                </div>
              )}

              {/* Navigation between sections */}
              <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-100 dark:border-gray-800">
                {(() => {
                  const idx = SECTIONS.findIndex(s => s.id === activeSection)
                  const prev = idx > 0 ? SECTIONS[idx - 1] : null
                  const next = idx < SECTIONS.length - 1 ? SECTIONS[idx + 1] : null
                  return (
                    <>
                      {prev ? (
                        <button
                          onClick={() => setActiveSection(prev.id)}
                          className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          {prev.title}
                        </button>
                      ) : <div />}
                      {next ? (
                        <button
                          onClick={() => setActiveSection(next.id)}
                          className="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
                        >
                          {next.title}
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      ) : <div />}
                    </>
                  )
                })()}
              </div>
            </div>
          )}

          {/* WhatsApp support CTA */}
          <div className="mt-6 card-static bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
            <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
              <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/40">
                <MessageCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-900 dark:text-green-200">Necesitas ayuda?</h3>
                <p className="text-sm text-green-700 dark:text-green-400">Escribinos por WhatsApp y te respondemos al toque</p>
              </div>
              <a
                href="https://wa.me/543518567543?text=Hola!%20Necesito%20ayuda%20con%20Alfredo"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
