#include <emscripten.h>
#include <stdlib.h>

int main() { return 0; }

EMSCRIPTEN_KEEPALIVE
unsigned char *randString(int len)
{
    unsigned char *str = malloc(len + 1);

    for (int i = 0; i < len; i++)
    {
        str[i] = rand() % (127 - 33) + 33;
        for (int j = 0; j < 100000000; j++)
        {
        }
    }

    str[len] = 0;
    return str;
}