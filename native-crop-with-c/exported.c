#include <emscripten.h>
#include <stdlib.h>

extern unsigned int curTime();
extern void logProgress(float progress);

int main() { return 0; }

EMSCRIPTEN_KEEPALIVE
unsigned char *randString(int len)
{
    unsigned char *str = malloc(len + 1);

    srand(curTime());

    for (int i = 0; i < len; i++)
    {
        str[i] = rand() % (127 - 33) + 33;
        logProgress((float)(i + 1) / (float)len);
        for (int j = 0; j < 100000000; j++)
        {
        }
    }

    str[len] = 0;
    return str;
}

// emcc exported.c -o dist/exported.wasm --no-entry -s EXPORTED_FUNCTIONS="['_randString', '_malloc', '_free']" -s ERROR_ON_UNDEFINED_SYMBOLS=0