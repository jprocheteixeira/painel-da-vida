"""Gera os ícones PNG do app (sem dependências): fundo preto com o traço vermelho do logo.

Uso (na pasta do projeto):  python ferramentas/gerar-icones.py
Saída: img/icone-192.png, img/icone-512.png, img/icone-maskable-512.png, img/apple-touch-icon.png
"""
import math
import os
import struct
import zlib

FUNDO = (0x1B, 0x14, 0x15)
TRACO = (0xE0, 0x54, 0x5C)
# traço do logo em coordenadas de 0 a 32 (o mesmo do SVG do cabeçalho)
PONTOS = [(8, 21), (13, 15), (17, 19), (24, 10)]
LARGURA_TRACO = 3.0


def dist_segmento(px, py, a, b):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def dentro_retangulo_arredondado(x, y, raio):
    # quadrado 0..32 com cantos de raio `raio`
    cx = min(max(x, raio), 32 - raio)
    cy = min(max(y, raio), 32 - raio)
    return math.hypot(x - cx, y - cy) <= raio


def gerar(tamanho, raio_canto, escala_logo, amostras):
    linhas = []
    passo = 32 / tamanho
    sub = [(i + 0.5) / amostras for i in range(amostras)]
    for py in range(tamanho):
        linha = bytearray([0])  # filtro PNG "none"
        for px in range(tamanho):
            fundo = traco = 0
            for sy in sub:
                for sx in sub:
                    x = (px + sx) * passo
                    y = (py + sy) * passo
                    if raio_canto and not dentro_retangulo_arredondado(x, y, raio_canto):
                        continue
                    fundo += 1
                    # logo escalado em torno do centro
                    lx = 16 + (x - 16) / escala_logo
                    ly = 16 + (y - 16) / escala_logo
                    if any(dist_segmento(lx, ly, PONTOS[i], PONTOS[i + 1]) <= LARGURA_TRACO / 2 for i in range(3)):
                        traco += 1
            total = amostras * amostras
            a_traco = traco / total
            a_fundo = fundo / total
            cor = [round(FUNDO[c] * (a_fundo - a_traco) / max(a_fundo, 1e-9) + TRACO[c] * a_traco / max(a_fundo, 1e-9))
                   if a_fundo else 0 for c in range(3)]
            linha += bytes(cor) + bytes([round(255 * a_fundo)])
        linhas.append(bytes(linha))
    return png(tamanho, b''.join(linhas))


def png(tamanho, dados):
    def bloco(tipo, conteudo):
        return struct.pack('>I', len(conteudo)) + tipo + conteudo + struct.pack('>I', zlib.crc32(tipo + conteudo) & 0xFFFFFFFF)
    ihdr = struct.pack('>IIBBBBB', tamanho, tamanho, 8, 6, 0, 0, 0)
    return b'\x89PNG\r\n\x1a\n' + bloco(b'IHDR', ihdr) + bloco(b'IDAT', zlib.compress(dados, 9)) + bloco(b'IEND', b'')


def main():
    pasta = os.path.join(os.path.dirname(__file__), '..', 'img')
    os.makedirs(pasta, exist_ok=True)
    saidas = {
        'icone-192.png': (192, 7, 1.0, 3),
        'icone-512.png': (512, 7, 1.0, 2),
        # maskable: sem cantos (o sistema recorta) e logo menor, dentro da zona segura
        'icone-maskable-512.png': (512, 0, 0.78, 2),
        # iPhone arredonda sozinho
        'apple-touch-icon.png': (180, 0, 0.9, 3),
    }
    for nome, (tam, raio, escala, amostras) in saidas.items():
        with open(os.path.join(pasta, nome), 'wb') as f:
            f.write(gerar(tam, raio, escala, amostras))
        print('ok', nome)


if __name__ == '__main__':
    main()
