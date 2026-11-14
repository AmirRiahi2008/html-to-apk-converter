# روی مک‌های M1/M2/M3 ابزارهای اندروید فقط با amd64 کار می‌کنن
ARG BASE=node:20-bookworm
FROM --platform=linux/amd64 ${BASE}
RUN apt-get update && apt-get install -y --no-install-recommends openjdk-17-jdk-headless unzip curl && rm -rf /var/lib/apt/lists/*

# Android SDK
ENV ANDROID_HOME=/opt/android ANDROID_SDK_ROOT=/opt/android
RUN mkdir -p $ANDROID_HOME/cmdline-tools && cd /tmp \
 && curl -sSLo t.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip \
 && unzip -q t.zip && mv cmdline-tools $ANDROID_HOME/cmdline-tools/latest && rm t.zip
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
RUN yes | sdkmanager --licenses >/dev/null && sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

# پروژه‌ی قالب Capacitor (یک بار ساخته و گرم می‌شه تا بیلدهای بعدی سریع باشن)
WORKDIR /opt/template
RUN npm init -y && npm i @capacitor/core@6 @capacitor/cli@6 @capacitor/android@6 \
 && mkdir www && echo '<html></html>' > www/index.html \
 && npx cap init App com.converted.app --web-dir=www \
 && npx cap add android && npx cap sync android \
 && printf '\nsystemProp.org.gradle.internal.http.connectionTimeout=120000\nsystemProp.org.gradle.internal.http.socketTimeout=120000\n' >> android/gradle.properties

# دانلود وابستگی‌ها با چند بار تلاش، چون ممکنه شبکه قطع و وصل بشه
RUN cd android && ok=0; for i in 1 2 3 4 5 6; do if ./gradlew assembleDebug --no-daemon; then ok=1; break; fi; echo "retry $i"; sleep 10; done; [ "$ok" = 1 ]

WORKDIR /app
COPY package.json server.js index.html ./
RUN npm install --omit=dev
EXPOSE 3000
CMD ["node", "server.js"]