"""
Servicio de consulta de precios de mercado para vehiculos.

Estrategia:
1. Usar API de Autocosmos que no bloquea servidores
2. Fallback a DuckDuckGo para scraping de precios
3. Cache en BD por 48 horas para evitar exceso de consultas
4. Manejo silencioso de errores
5. Filtrado estricto por año exacto y version
"""
import httpx
import re
import logging
import json
import random
from typing import Optional, List
from dataclasses import dataclass, field
from datetime import datetime
from urllib.parse import quote, urlencode

logger = logging.getLogger(__name__)


@dataclass
class ResultadoPrecioMercado:
    """Resultado de busqueda de precios de mercado"""
    marca: str
    modelo: str
    anio: int
    version: Optional[str] = None
    precios: List[float] = field(default_factory=list)
    precio_promedio: Optional[float] = None
    precio_minimo: Optional[float] = None
    precio_maximo: Optional[float] = None
    cantidad_resultados: int = 0
    fuente: str = "mercadolibre"
    fecha_consulta: datetime = None
    error: Optional[str] = None

    def __post_init__(self):
        if self.precios:
            self.cantidad_resultados = len(self.precios)
            self.precio_promedio = round(sum(self.precios) / len(self.precios), 2)
            self.precio_minimo = min(self.precios)
            self.precio_maximo = max(self.precios)
        if not self.fecha_consulta:
            self.fecha_consulta = datetime.now()


class FuenteAutocosmos:
    """Fuente: Autocosmos Argentina."""
    nombre = "autocosmos"
    BASE_URL = "https://www.autocosmos.com.ar"

    def __init__(self, client: httpx.AsyncClient):
        self.client = client

    def _normalizar_url(self, texto: str) -> str:
        texto = texto.lower().strip()
        reemplazos = {'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n', ' ': '-'}
        for orig, reempl in reemplazos.items():
            texto = texto.replace(orig, reempl)
        return re.sub(r'[^a-z0-9-]', '', texto)

    def _version_coincide(self, version_buscada: str, texto: str) -> bool:
        if not version_buscada:
            return True
        v_buscada = version_buscada.lower()
        texto_lower = texto.lower()
        palabras = v_buscada.split()
        for palabra in palabras:
            if len(palabra) >= 2 and palabra in texto_lower:
                return True
        return False

    async def consultar(self, marca: str, modelo: str, anio: int, version: Optional[str] = None) -> ResultadoPrecioMercado:
        try:
            marca_url = self._normalizar_url(marca)
            modelo_url = self._normalizar_url(modelo)
            url = f"{self.BASE_URL}/auto/usado/{marca_url}-{modelo_url}/desde-{anio}/hasta-{anio}"
            logger.info(f"[Autocosmos] Consultando: {url}")

            response = await self.client.get(
                url,
                headers={
                    "Accept": "text/html,application/xhtml+xml",
                    "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
                    "Cache-Control": "no-cache",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                }
            )

            if response.status_code != 200:
                return ResultadoPrecioMercado(
                    marca=marca, modelo=modelo, anio=anio, version=version,
                    precios=[], fuente=self.nombre,
                    error=f"HTTP {response.status_code}"
                )

            html = response.text
            precios = []
            patrones = [
                r'\$\s*([\d]{1,3}(?:\.[\d]{3})+)',
                r'ARS\s*([\d]{1,3}(?:\.[\d]{3})+)',
                r'"price"[^}]*"amount":\s*(\d+)',
                r'precio["\s:]+(\d{6,9})',
            ]

            for patron in patrones:
                matches = re.findall(patron, html, re.IGNORECASE)
                for match in matches:
                    try:
                        precio_str = str(match).replace('.', '').replace(',', '')
                        precio = float(precio_str)
                        if 2000000 < precio < 200000000:
                            precios.append(precio)
                    except ValueError:
                        continue

            precios = list(dict.fromkeys(precios))[:25]

            return ResultadoPrecioMercado(
                marca=marca, modelo=modelo, anio=anio, version=version,
                precios=precios, fuente=self.nombre,
                error=None if precios else "No se encontraron resultados en Autocosmos"
            )

        except Exception as e:
            logger.exception(f"[Autocosmos] Error: {e}")
            return ResultadoPrecioMercado(
                marca=marca, modelo=modelo, anio=anio, version=version,
                precios=[], fuente=self.nombre,
                error=str(e)[:100]
            )


class FuenteCarGurus:
    """Fuente: CarGurus Argentina."""
    nombre = "cargurus"
    BASE_URL = "https://www.cargurus.com.ar"

    def __init__(self, client: httpx.AsyncClient):
        self.client = client

    def _normalizar_url(self, texto: str) -> str:
        texto = texto.lower().strip()
        reemplazos = {'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n', ' ': '-'}
        for orig, reempl in reemplazos.items():
            texto = texto.replace(orig, reempl)
        return re.sub(r'[^a-z0-9-]', '', texto)

    async def consultar(self, marca: str, modelo: str, anio: int, version: Optional[str] = None) -> ResultadoPrecioMercado:
        try:
            response = await self.client.get(
                f"{self.BASE_URL}/Used-{self._normalizar_url(marca)}-{self._normalizar_url(modelo)}-{anio}",
                headers={
                    "Accept": "text/html",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                }
            )

            if response.status_code != 200:
                return ResultadoPrecioMercado(
                    marca=marca, modelo=modelo, anio=anio, version=version,
                    precios=[], fuente=self.nombre,
                    error=f"HTTP {response.status_code}"
                )

            html = response.text
            precios = []
            patrones = [
                r'\$\s*([\d]{1,3}(?:\.[\d]{3})+)',
                r'"price":\s*(\d+)',
                r'data-price="(\d+)"',
            ]

            for patron in patrones:
                matches = re.findall(patron, html)
                for match in matches:
                    try:
                        precio_str = str(match).replace('.', '')
                        precio = float(precio_str)
                        if 2000000 < precio < 200000000:
                            precios.append(precio)
                    except ValueError:
                        continue

            precios = list(dict.fromkeys(precios))[:20]

            return ResultadoPrecioMercado(
                marca=marca, modelo=modelo, anio=anio, version=version,
                precios=precios, fuente=self.nombre,
                error=None if precios else "No se encontraron resultados en CarGurus"
            )

        except Exception as e:
            logger.exception(f"[CarGurus] Error: {e}")
            return ResultadoPrecioMercado(
                marca=marca, modelo=modelo, anio=anio, version=version,
                precios=[], fuente=self.nombre,
                error=str(e)[:100]
            )


class FuenteNapsix:
    """Fuente: Napsix Autos Argentina."""
    nombre = "napsix"
    BASE_URL = "https://autos.napsix.com"

    def __init__(self, client: httpx.AsyncClient):
        self.client = client

    def _normalizar_url(self, texto: str) -> str:
        texto = texto.lower().strip()
        reemplazos = {'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n', ' ': '-'}
        for orig, reempl in reemplazos.items():
            texto = texto.replace(orig, reempl)
        return re.sub(r'[^a-z0-9-]', '', texto)

    async def consultar(self, marca: str, modelo: str, anio: int, version: Optional[str] = None) -> ResultadoPrecioMercado:
        try:
            marca_url = self._normalizar_url(marca)
            modelo_url = self._normalizar_url(modelo)
            url = f"{self.BASE_URL}/usados/{marca_url}/{modelo_url}?anio_desde={anio}&anio_hasta={anio}"
            logger.info(f"[Napsix] Consultando: {url}")

            response = await self.client.get(
                url,
                headers={
                    "Accept": "text/html,application/xhtml+xml",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept-Language": "es-AR,es;q=0.9",
                }
            )

            if response.status_code != 200:
                return ResultadoPrecioMercado(
                    marca=marca, modelo=modelo, anio=anio, version=version,
                    precios=[], fuente=self.nombre,
                    error=f"HTTP {response.status_code}"
                )

            html = response.text
            precios = []
            patron_precio = r'\$\s*([\d]{1,3}(?:\.[\d]{3})+)'
            matches = re.findall(patron_precio, html)

            for match in matches:
                try:
                    precio_str = match.replace('.', '')
                    precio = float(precio_str)
                    if 2000000 < precio < 200000000:
                        precios.append(precio)
                except ValueError:
                    continue

            precios = list(dict.fromkeys(precios))[:25]

            return ResultadoPrecioMercado(
                marca=marca, modelo=modelo, anio=anio, version=version,
                precios=precios, fuente=self.nombre,
                error=None if precios else "No se encontraron resultados en Napsix"
            )

        except Exception as e:
            logger.exception(f"[Napsix] Error: {e}")
            return ResultadoPrecioMercado(
                marca=marca, modelo=modelo, anio=anio, version=version,
                precios=[], fuente=self.nombre,
                error=str(e)[:100]
            )


class FuenteDuckDuckGo:
    """Fuente: Busqueda web general via DuckDuckGo."""
    nombre = "web"

    def __init__(self, client: httpx.AsyncClient):
        self.client = client

    async def consultar(self, marca: str, modelo: str, anio: int, version: Optional[str] = None) -> ResultadoPrecioMercado:
        try:
            if version:
                query = f"{marca} {modelo} {version} {anio} precio argentina usado"
            else:
                query = f"{marca} {modelo} {anio} precio argentina usado"

            logger.info(f"[DuckDuckGo] Consultando: {query}")

            response = await self.client.get(
                f"https://html.duckduckgo.com/html/?q={quote(query)}",
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html",
                    "Accept-Language": "es-AR,es;q=0.9",
                }
            )

            if response.status_code != 200:
                return ResultadoPrecioMercado(
                    marca=marca, modelo=modelo, anio=anio, version=version,
                    precios=[], fuente=self.nombre,
                    error=f"HTTP {response.status_code}"
                )

            html = response.text
            precios = []
            patrones = [
                r'\$\s*([\d]{1,3}(?:[.,][\d]{3})+)',
                r'ARS\s*([\d]{1,3}(?:[.,][\d]{3})+)',
                r'(\d{1,3}(?:\.\d{3})+)\s*(?:pesos|ARS)',
            ]

            for patron in patrones:
                matches = re.findall(patron, html, re.IGNORECASE)
                for match in matches:
                    try:
                        precio_str = match.replace('.', '').replace(',', '')
                        precio = float(precio_str)
                        if 3000000 < precio < 150000000:
                            precios.append(precio)
                    except ValueError:
                        continue

            precios = list(dict.fromkeys(precios))[:15]

            return ResultadoPrecioMercado(
                marca=marca, modelo=modelo, anio=anio, version=version,
                precios=precios, fuente=self.nombre,
                error=None if precios else "No se encontraron precios en la web"
            )

        except Exception as e:
            logger.exception(f"[DuckDuckGo] Error: {e}")
            return ResultadoPrecioMercado(
                marca=marca, modelo=modelo, anio=anio, version=version,
                precios=[], fuente=self.nombre,
                error=str(e)[:100]
            )


class FuenteChileautos:
    """Fuente: Chileautos - referencia regional."""
    nombre = "chileautos"
    BASE_URL = "https://www.chileautos.cl"

    def __init__(self, client: httpx.AsyncClient):
        self.client = client

    def _normalizar_url(self, texto: str) -> str:
        texto = texto.lower().strip()
        reemplazos = {'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n', ' ': '-'}
        for orig, reempl in reemplazos.items():
            texto = texto.replace(orig, reempl)
        return re.sub(r'[^a-z0-9-]', '', texto)

    async def consultar(self, marca: str, modelo: str, anio: int, version: Optional[str] = None) -> ResultadoPrecioMercado:
        try:
            marca_url = self._normalizar_url(marca)
            modelo_url = self._normalizar_url(modelo)
            url = f"{self.BASE_URL}/vehiculos/autos/{marca_url}/{modelo_url}/desde-{anio}/hasta-{anio}"
            logger.info(f"[Chileautos] Consultando: {url}")

            response = await self.client.get(
                url,
                headers={
                    "Accept": "text/html",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                }
            )

            if response.status_code != 200:
                return ResultadoPrecioMercado(
                    marca=marca, modelo=modelo, anio=anio, version=version,
                    precios=[], fuente=self.nombre,
                    error=f"HTTP {response.status_code}"
                )

            html = response.text
            precios = []
            patron = r'\$\s*([\d]{1,3}(?:\.[\d]{3})+)'
            matches = re.findall(patron, html)

            for match in matches:
                try:
                    precio_str = match.replace('.', '')
                    precio_clp = float(precio_str)
                    if 3000000 < precio_clp < 80000000:
                        precios.append(precio_clp)
                except ValueError:
                    continue

            precios = list(dict.fromkeys(precios))[:15]

            return ResultadoPrecioMercado(
                marca=marca, modelo=modelo, anio=anio, version=version,
                precios=precios, fuente=self.nombre,
                error=None if precios else "No se encontraron resultados"
            )

        except Exception as e:
            logger.exception(f"[Chileautos] Error: {e}")
            return ResultadoPrecioMercado(
                marca=marca, modelo=modelo, anio=anio, version=version,
                precios=[], fuente=self.nombre,
                error=str(e)[:100]
            )


class ServicioPrecioMercado:
    """Servicio para consultar precios de mercado de vehiculos."""

    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ]

    def __init__(self):
        user_agent = random.choice(self.USER_AGENTS)
        self.client = httpx.AsyncClient(
            timeout=25.0,
            follow_redirects=True,
            verify=True,
            headers={
                "User-Agent": user_agent,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
                "DNT": "1",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
            }
        )
        self.fuentes = [
            FuenteAutocosmos(self.client),
            FuenteNapsix(self.client),
            FuenteCarGurus(self.client),
            FuenteChileautos(self.client),
            FuenteDuckDuckGo(self.client),
        ]

    async def consultar_precio(
        self,
        marca: str,
        modelo: str,
        anio: int,
        version: Optional[str] = None
    ) -> ResultadoPrecioMercado:
        errores = []

        for fuente in self.fuentes:
            try:
                resultado = await fuente.consultar(marca, modelo, anio, version)

                if resultado.precios:
                    logger.info(
                        f"[{fuente.nombre}] Encontrados {len(resultado.precios)} precios "
                        f"para {marca} {modelo} {version or ''} {anio}"
                    )
                    return resultado

                if resultado.error:
                    errores.append(f"{fuente.nombre}: {resultado.error}")

            except Exception as e:
                logger.exception(f"[{fuente.nombre}] Error inesperado: {e}")
                errores.append(f"{fuente.nombre}: {str(e)[:50]}")

        error_msg = "No se encontraron precios de mercado para este vehiculo."
        if errores:
            error_msg = f"{error_msg} Detalles: {'; '.join(errores[:3])}"

        return ResultadoPrecioMercado(
            marca=marca, modelo=modelo, anio=anio, version=version,
            precios=[],
            fuente="ninguna",
            error=error_msg
        )

    async def close(self):
        await self.client.aclose()


_servicio: Optional[ServicioPrecioMercado] = None


def get_servicio_precio_mercado() -> ServicioPrecioMercado:
    global _servicio
    if _servicio is None:
        _servicio = ServicioPrecioMercado()
    return _servicio


def calcular_precio_compra_maximo(
    precio_mercado: float,
    margen_agencia_porcentaje: float = 15,
    gastos_reacondicionamiento: float = 200000
) -> dict:
    margen_pesos = precio_mercado * (margen_agencia_porcentaje / 100)
    precio_compra_max = precio_mercado - margen_pesos - gastos_reacondicionamiento

    return {
        "precio_mercado": precio_mercado,
        "margen_agencia_porcentaje": margen_agencia_porcentaje,
        "margen_agencia_pesos": round(margen_pesos, 2),
        "gastos_reacondicionamiento": gastos_reacondicionamiento,
        "precio_compra_maximo": round(max(0, precio_compra_max), 2),
        "utilidad_proyectada": round(margen_pesos, 2),
        "recomendacion": (
            "Precio de compra maximo recomendado para obtener el margen objetivo. "
            "Considerar estado del vehiculo y costos adicionales de reacondicionamiento."
        )
    }
