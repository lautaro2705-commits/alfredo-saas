import { forwardRef } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

/**
 * Componente de Boleto de Compra-Venta para impresion.
 * Genera dos copias asimetricas:
 * - Original (Comprador): Sin km de entrega
 * - Duplicado (Agencia): Con km de entrega y espacio para firma de conformidad
 */
const BoletoCompraVenta = forwardRef(({ data, tipo = 'ambos' }, ref) => {
  if (!data) return null

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value || 0)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return format(new Date(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: es })
  }

  const formatNumber = (num) => {
    return new Intl.NumberFormat('es-AR').format(num || 0)
  }

  // Componente de copia individual
  const CopiaDocumento = ({ esOriginal }) => (
    <div className={`boleto-pagina ${esOriginal ? 'original' : 'duplicado'}`}>
      {/* Encabezado con logo y datos agencia */}
      <header className="boleto-header">
        <div className="agencia-info">
          <img src="/logo-canova.jpg" alt="Canova Automotores" className="logo-agencia" />
          <div className="agencia-datos">
            <h1>CANOVA AUTOMOTORES</h1>
            <p>Coronel Olmedo 381 - Cordoba</p>
            <p>Tel: 351-2085493</p>
          </div>
        </div>
        <div className="documento-info">
          <h2>BOLETO DE COMPRA-VENTA</h2>
          <p className="tipo-copia">
            {esOriginal ? 'ORIGINAL - COMPRADOR' : 'DUPLICADO - AGENCIA'}
          </p>
          <p className="numero-operacion">Operacion N° {data.operacion_id}</p>
        </div>
      </header>

      {/* Fecha */}
      <div className="fecha-seccion">
        <p>
          En la ciudad de ______________, a los {format(new Date(data.fecha_operacion), 'dd')} dias
          del mes de {format(new Date(data.fecha_operacion), 'MMMM', { locale: es })} de {format(new Date(data.fecha_operacion), 'yyyy')},
          se celebra el presente contrato de compra-venta de automotor entre las partes:
        </p>
      </div>

      {/* Datos del comprador */}
      <section className="seccion">
        <h3>COMPRADOR</h3>
        <div className="datos-grid">
          <div className="dato">
            <label>Nombre y Apellido:</label>
            <span>{data.cliente_nombre} {data.cliente_apellido}</span>
          </div>
          <div className="dato">
            <label>DNI/CUIT:</label>
            <span>{data.cliente_dni}</span>
          </div>
          <div className="dato full-width">
            <label>Domicilio:</label>
            <span>
              {[data.cliente_direccion, data.cliente_localidad, data.cliente_provincia]
                .filter(Boolean).join(', ') || '-'}
            </span>
          </div>
          <div className="dato">
            <label>Telefono:</label>
            <span>{data.cliente_telefono || '-'}</span>
          </div>
        </div>
      </section>

      {/* Datos del vehiculo */}
      <section className="seccion">
        <h3>VEHICULO</h3>
        <div className="datos-grid">
          <div className="dato">
            <label>Marca:</label>
            <span>{data.vehiculo_marca}</span>
          </div>
          <div className="dato">
            <label>Modelo:</label>
            <span>{data.vehiculo_modelo}</span>
          </div>
          <div className="dato">
            <label>Version:</label>
            <span>{data.vehiculo_version || '-'}</span>
          </div>
          <div className="dato">
            <label>Ano:</label>
            <span>{data.vehiculo_anio}</span>
          </div>
          <div className="dato">
            <label>Dominio (Patente):</label>
            <span className="destacado">{data.vehiculo_dominio}</span>
          </div>
          <div className="dato">
            <label>Color:</label>
            <span>{data.vehiculo_color || '-'}</span>
          </div>
          <div className="dato">
            <label>N° Chasis:</label>
            <span>{data.vehiculo_chasis || '-'}</span>
          </div>
          <div className="dato">
            <label>N° Motor:</label>
            <span>{data.vehiculo_motor || '-'}</span>
          </div>
          <div className="dato">
            <label>Combustible:</label>
            <span>{data.vehiculo_combustible || '-'}</span>
          </div>
        </div>
      </section>

      {/* Seccion de kilometraje - SOLO para la copia de la agencia */}
      {!esOriginal && (
        <section className="seccion seccion-km">
          <h3>KILOMETRAJE DE ENTREGA</h3>
          <div className="km-box">
            <div className="km-valor">
              <label>Kilometraje al momento de entrega:</label>
              <span className="km-numero">{formatNumber(data.km_entrega)} km</span>
            </div>
            <div className="conformidad-km">
              <p>
                El comprador declara haber verificado y aceptar el kilometraje indicado,
                el cual servira de base para el computo de la garantia.
              </p>
              <div className="firma-km">
                <div className="linea-firma"></div>
                <p>Firma del Comprador</p>
                <div className="linea-firma"></div>
                <p>Aclaracion</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Datos economicos */}
      <section className="seccion">
        <h3>CONDICIONES ECONOMICAS</h3>
        <div className="datos-economicos">
          <div className="linea-economica">
            <span>Precio del Vehiculo:</span>
            <span className="monto">{formatCurrency(data.precio_sin_transferencia)}</span>
          </div>
          <div className="linea-economica">
            <span>Costo de Transferencia:</span>
            <span className="monto">{formatCurrency(data.costo_transferencia)}</span>
          </div>
          <div className="linea-economica total">
            <span>PRECIO TOTAL:</span>
            <span className="monto">{formatCurrency(data.precio_venta)}</span>
          </div>
          <div className="linea-economica">
            <span>Forma de Pago:</span>
            <span>{data.forma_pago === 'contado' ? 'Contado' :
                   data.forma_pago === 'financiado' ? 'Financiado' : 'Mixto'}</span>
          </div>
        </div>
      </section>

      {/* Clausula de garantia */}
      <section className="seccion seccion-garantia">
        <h3>GARANTIA</h3>
        <div className="garantia-contenido">
          <p>
            <strong>El vendedor otorga garantia de TRES (3) MESES o DOS MIL (2.000) KILOMETROS</strong>,
            lo que ocurra primero, exclusivamente sobre <strong>MOTOR y CAJA DE CAMBIOS</strong>.
          </p>

          {!esOriginal && (
            <div className="garantia-limites">
              <p><strong>Vencimiento de garantia:</strong></p>
              <ul>
                <li>Por fecha: {formatDate(data.garantia_fecha_limite)}</li>
                <li>Por kilometraje: {formatNumber(data.garantia_km_limite)} km</li>
              </ul>
            </div>
          )}

          <p className="plazo-defectos">
            Para otros desperfectos o vicios aparentes, el comprador cuenta con un plazo
            de <strong>SETENTA Y DOS (72) HORAS</strong> desde la entrega del vehiculo
            para efectuar el reclamo correspondiente.
          </p>

          <p className="exclusiones">
            <em>
              Quedan excluidos de la garantia: mantenimiento general, desgaste normal de piezas,
              accesorios, carroceria, tapizado, electricidad no relacionada con motor/caja,
              neumaticos, frenos, embrague, suspension, direccion, aire acondicionado,
              y cualquier dano causado por mal uso, negligencia o accidente.
            </em>
          </p>
        </div>
      </section>

      {/* Nota sobre transferencia */}
      <section className="seccion seccion-transferencia">
        <h3>TRANSFERENCIA</h3>
        <p>
          La transferencia del vehiculo se realizara segun la disponibilidad del Registro
          del Automotor y los tiempos de gestion correspondientes. El costo de la transferencia
          se encuentra detallado en las condiciones economicas del presente boleto.
        </p>
      </section>

      {/* Firmas */}
      <section className="seccion-firmas">
        <div className="firma-box">
          <div className="firma-contenido">
            <div className="linea-firma-grande"></div>
            <p className="firma-titulo">COMPRADOR</p>
            <div className="firma-datos">
              <div className="firma-linea">
                <label>Firma:</label>
                <span className="linea-escribir"></span>
              </div>
              <div className="firma-linea">
                <label>Aclaracion:</label>
                <span className="linea-escribir"></span>
              </div>
              <div className="firma-linea">
                <label>DNI:</label>
                <span className="linea-escribir"></span>
              </div>
            </div>
          </div>
        </div>
        <div className="firma-box">
          <div className="firma-contenido">
            <div className="linea-firma-grande"></div>
            <p className="firma-titulo">VENDEDOR</p>
            <p className="firma-subtitulo">(En representacion de la Agencia)</p>
            <div className="firma-datos">
              <div className="firma-linea">
                <label>Firma:</label>
                <span className="linea-escribir"></span>
              </div>
              <div className="firma-linea">
                <label>Aclaracion:</label>
                <span className="linea-escribir"></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pie de pagina */}
      <footer className="boleto-footer">
        <p className="agencia-footer">CANOVA AUTOMOTORES - Coronel Olmedo 381, Cordoba - Tel: 351-2085493</p>
        <p className="fecha-impresion">Documento generado el {format(new Date(), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}</p>
      </footer>
    </div>
  )

  return (
    <div ref={ref} className="boleto-container">
      {/* Estilos de impresion */}
      <style>{`
        /* ========================================
           RESET - neutraliza Tailwind Preflight
           ======================================== */
        .boleto-container,
        .boleto-container * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          line-height: 1.35;
          border: none;
        }

        .boleto-container {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #1a1a1a;
        }

        .boleto-container img {
          display: inline-block;
        }

        .boleto-container ul {
          list-style: disc;
        }

        /* ========================================
           PAGINA A4
           ======================================== */
        .boleto-pagina {
          width: 210mm;
          height: 297mm;
          padding: 10mm 12mm;
          margin: 0 auto;
          background: white;
          overflow: hidden;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        /* ========================================
           HEADER
           ======================================== */
        .boleto-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: 8px;
          border-bottom: 2.5px solid #1e3a5f !important;
          margin-bottom: 10px;
        }

        .agencia-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .logo-agencia {
          height: 44px;
          width: auto;
          object-fit: contain;
        }

        .agencia-datos h1 {
          font-size: 15px;
          font-weight: 700;
          color: #1e3a5f;
          letter-spacing: 0.5px;
        }

        .agencia-datos p {
          font-size: 9px;
          color: #4b5563;
        }

        .documento-info {
          text-align: right;
        }

        .documento-info h2 {
          font-size: 14px;
          color: #1e3a5f;
          font-weight: 700;
          letter-spacing: 0.3px;
        }

        .tipo-copia {
          margin: 3px 0;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 3px;
          display: inline-block;
          letter-spacing: 0.3px;
        }

        .original .tipo-copia {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .duplicado .tipo-copia {
          background: #fef3c7;
          color: #b45309;
        }

        .numero-operacion {
          font-size: 9px;
          color: #6b7280;
          margin-top: 2px;
        }

        /* ========================================
           FECHA
           ======================================== */
        .fecha-seccion {
          margin-bottom: 8px;
          font-size: 9.5px;
          text-align: justify;
        }

        /* ========================================
           SECCIONES
           ======================================== */
        .seccion {
          margin-bottom: 8px;
        }

        .seccion h3 {
          margin-bottom: 5px;
          padding: 3px 8px;
          background: #f1f5f9;
          font-size: 10px;
          font-weight: 700;
          color: #1e3a5f;
          border-left: 3px solid #1e3a5f !important;
          letter-spacing: 0.5px;
        }

        /* ========================================
           GRID DE DATOS
           ======================================== */
        .datos-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 4px 12px;
        }

        .dato {
          display: flex;
          flex-direction: column;
        }

        .dato.full-width {
          grid-column: span 3;
        }

        .dato label {
          font-size: 8px;
          color: #6b7280;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .dato span {
          font-size: 10px;
          font-weight: 500;
        }

        .dato span.destacado {
          font-weight: 700;
          color: #1e3a5f;
          font-size: 11px;
        }

        /* ========================================
           KILOMETRAJE (solo duplicado)
           ======================================== */
        .seccion-km {
          border: 2px solid #b45309 !important;
          padding: 6px 8px;
          background: #fffbeb;
          border-radius: 4px;
        }

        .seccion-km h3 {
          background: #b45309;
          color: white;
          border-left: none !important;
          border-radius: 2px;
        }

        .km-box {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .km-valor {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .km-valor label {
          font-size: 9.5px;
          font-weight: 500;
        }

        .km-numero {
          font-size: 15px;
          font-weight: 700;
          color: #b45309;
          padding: 2px 12px;
          background: white;
          border: 2px solid #b45309 !important;
          border-radius: 4px;
        }

        .conformidad-km {
          border-top: 1px dashed #b45309 !important;
          padding-top: 5px;
        }

        .conformidad-km > p {
          margin-bottom: 5px;
          font-size: 8px;
          font-style: italic;
          color: #78350f;
        }

        .firma-km {
          display: flex;
          gap: 20px;
          align-items: flex-end;
        }

        .firma-km .linea-firma {
          flex: 1;
          border-bottom: 1px solid #1a1a1a !important;
          height: 18px;
        }

        .firma-km p {
          margin-top: 1px;
          font-size: 7.5px;
          text-align: center;
          color: #4b5563;
        }

        /* ========================================
           CONDICIONES ECONOMICAS
           ======================================== */
        .datos-economicos {
          border: 1px solid #d1d5db !important;
          border-radius: 4px;
          overflow: hidden;
        }

        .linea-economica {
          display: flex;
          justify-content: space-between;
          padding: 4px 10px;
          font-size: 10px;
          border-bottom: 1px solid #e5e7eb !important;
        }

        .linea-economica:last-child {
          border-bottom: none !important;
        }

        .linea-economica.total {
          background: #1e3a5f;
          color: white;
          font-weight: 700;
          font-size: 11.5px;
          padding: 5px 10px;
        }

        .linea-economica .monto {
          font-weight: 600;
        }

        /* ========================================
           GARANTIA
           ======================================== */
        .seccion-garantia {
          border: 1px solid #059669 !important;
          padding: 6px 8px;
          background: #ecfdf5;
          border-radius: 4px;
        }

        .seccion-garantia h3 {
          background: #059669;
          color: white;
          border-left: none !important;
          border-radius: 2px;
        }

        .garantia-contenido {
          font-size: 9px;
        }

        .garantia-contenido p {
          margin-bottom: 4px;
          text-align: justify;
        }

        .garantia-limites {
          background: white;
          padding: 4px 8px;
          border-radius: 3px;
          margin: 5px 0;
          border: 1px solid #a7f3d0 !important;
        }

        .garantia-limites ul {
          margin-left: 16px;
          margin-top: 3px;
        }

        .garantia-limites li {
          margin-bottom: 2px;
        }

        .plazo-defectos {
          padding: 4px 8px;
          background: #fef3c7;
          border-radius: 3px;
        }

        .exclusiones {
          font-size: 8px;
          color: #6b7280;
          line-height: 1.3;
        }

        /* ========================================
           TRANSFERENCIA
           ======================================== */
        .seccion-transferencia p {
          font-size: 9px;
          text-align: justify;
        }

        /* ========================================
           FIRMAS
           ======================================== */
        .seccion-firmas {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          margin-top: auto;
          padding-top: 10px;
          border-top: 1.5px solid #d1d5db !important;
        }

        .firma-box {
          flex: 1;
          text-align: center;
        }

        .firma-contenido {
          padding: 4px 10px;
        }

        .linea-firma-grande {
          border-bottom: 1px solid #1a1a1a !important;
          height: 35px;
          margin-bottom: 3px;
        }

        .firma-titulo {
          font-size: 10px;
          font-weight: 700;
          color: #1e3a5f;
          letter-spacing: 0.5px;
        }

        .firma-subtitulo {
          font-size: 8px;
          color: #6b7280;
        }

        .firma-datos {
          margin-top: 6px;
          text-align: left;
        }

        .firma-linea {
          display: flex;
          align-items: flex-end;
          gap: 6px;
          margin-bottom: 5px;
        }

        .firma-linea label {
          font-size: 8px;
          color: #6b7280;
          min-width: 55px;
          font-weight: 500;
        }

        .linea-escribir {
          flex: 1;
          border-bottom: 1px dotted #9ca3af !important;
          height: 14px;
        }

        /* ========================================
           FOOTER
           ======================================== */
        .boleto-footer {
          margin-top: 8px;
          padding-top: 6px;
          border-top: 1px solid #e5e7eb !important;
          text-align: center;
          font-size: 8px;
          color: #9ca3af;
        }

        .boleto-footer p {
          margin: 1px 0;
        }

        .boleto-footer .agencia-footer {
          font-weight: 600;
          color: #6b7280;
        }

        /* ========================================
           PAGE BREAK
           ======================================== */
        .page-break {
          page-break-after: always;
          height: 0;
        }

        /* ========================================
           PRINT STYLES
           ======================================== */
        @media print {
          @page {
            size: A4;
            margin: 0;
          }

          body {
            margin: 0 !important;
            padding: 0 !important;
          }

          .boleto-container {
            width: 100%;
          }

          .boleto-pagina {
            width: 210mm;
            height: 297mm;
            padding: 10mm 12mm;
            margin: 0;
            page-break-after: always;
            box-shadow: none;
            overflow: hidden;
          }

          .boleto-pagina:last-child {
            page-break-after: auto;
          }

          .no-print {
            display: none !important;
          }

          /* Forzar colores en impresion */
          .boleto-container * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }

        /* ========================================
           SCREEN PREVIEW
           ======================================== */
        @media screen {
          .boleto-pagina {
            box-shadow: 0 1px 8px rgba(0,0,0,0.12);
            margin-bottom: 24px;
            border: 1px solid #e5e7eb;
          }
        }
      `}</style>

      {/* Renderizar copias segun el tipo solicitado */}
      {(tipo === 'ambos' || tipo === 'original') && (
        <>
          <CopiaDocumento esOriginal={true} />
          {tipo === 'ambos' && <div className="page-break" />}
        </>
      )}

      {(tipo === 'ambos' || tipo === 'duplicado') && (
        <CopiaDocumento esOriginal={false} />
      )}
    </div>
  )
})

BoletoCompraVenta.displayName = 'BoletoCompraVenta'

export default BoletoCompraVenta
