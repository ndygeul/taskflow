FROM python:3.11-slim-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssh-client \
    unixodbc \
    unixodbc-dev \
    g++ \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /opt/tibero/client/config

COPY ./tibero/libtbodbc.so /opt/tibero/
COPY ./tibero/libtbcli.so /opt/tibero/
COPY ./tibero/odbcinst.ini /etc/odbcinst.ini

ENV LD_LIBRARY_PATH=/opt/tibero:$LD_LIBRARY_PATH
ENV TB_CLI_DIR=/opt/tibero

ARG INSTALL_ORACLE_CLIENT=true

RUN if [ "$INSTALL_ORACLE_CLIENT" = "true" ]; then \
        echo "[Thick Mode] Oracle Instant Client 설치를 시작합니다..." && \
        apt-get update && apt-get install -y --no-install-recommends \
            libaio1 \
            wget \
            unzip && \
        mkdir -p /opt/oracle && \
        cd /opt/oracle && \
        wget -q https://download.oracle.com/otn_software/linux/instantclient/1925000/instantclient-basic-linux.x64-19.25.0.0.0dbru.zip && \
        unzip instantclient-basic-linux.x64-19.25.0.0.0dbru.zip && \
        rm instantclient-basic-linux.x64-19.25.0.0.0dbru.zip && \
        sh -c "echo /opt/oracle/instantclient_19_25 > /etc/ld.so.conf.d/oracle-instantclient.conf" && \
        ldconfig && \
        apt-get remove -y wget unzip && \
        apt-get autoremove -y && \
        rm -rf /var/lib/apt/lists/* && \
        echo "설치 완료"; \
    else \
        echo "[Thin Mode] Oracle Instant Client 설치를 건너뜁니다."; \
    fi

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ./app /app/app
COPY ./static /app/static
COPY ./templates /app/templates
COPY ./scripts /app/scripts

EXPOSE 80

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "80"]