(function () {
    'use strict';

    var root = document.documentElement;
    root.classList.add('main-ready');

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function $(sel, ctx) { return (ctx || document).querySelector(sel); }
    function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

    function copyText(text, onDone, onFail) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(onDone, onFail);
        } else {
            onFail();
        }
    }

    // =================================================================
    // 1. Номер телефону. Закодований: charCode кожного символу + KEY.
    //    Щоб змінити номер: у консолі браузера виконайте
    //    JSON.stringify([..."+380XXXXXXXXX"].map(c => c.charCodeAt(0) + 7))
    // =================================================================
    var KEY = 7;
    var CODES = [50,58,63,55,61,58,60,55,61,57,58,62,56];

    var PHONE = CODES.map(function (c) { return String.fromCharCode(c - KEY); }).join('');
    var PRETTY = PHONE.slice(0, 3) + ' (' + PHONE.slice(3, 6) + ') ' +
                 PHONE.slice(6, 9) + '-' + PHONE.slice(9, 11) + '-' + PHONE.slice(11);

    $all('.js-phone').forEach(function (a) {
        a.href = 'tel:' + PHONE;
        var label = a.getAttribute('data-label');
        if (label) {
            var target = a.querySelector('.js-phone-text') || a;
            target.textContent = label.replace('{pretty}', PRETTY);
        }
    });

    // =================================================================
    // 2. Viber + підказка, якщо застосунок не відкрився
    // =================================================================
    var viberBox = $('#viber-fallback');
    var copyPhoneBtn = $('#copy-phone');

    $all('.js-viber').forEach(function (link) {
        link.href = 'viber://chat?number=' + encodeURIComponent(PHONE);
        if (!viberBox) return;

        link.addEventListener('click', function () {
            var left = false;
            function markLeft() { left = true; }
            window.addEventListener('blur', markLeft, { once: true });
            document.addEventListener('visibilitychange', markLeft, { once: true });

            setTimeout(function () {
                window.removeEventListener('blur', markLeft);
                document.removeEventListener('visibilitychange', markLeft);
                if (!left) {
                    link.parentNode.insertAdjacentElement('afterend', viberBox);
                    viberBox.hidden = false;
                }
            }, 1500);
        });
    });

    if (copyPhoneBtn) {
        var copyLabel = copyPhoneBtn.textContent;
        var copyTimer;
        copyPhoneBtn.addEventListener('click', function () {
            copyText(PHONE, function () {
                copyPhoneBtn.textContent = 'Номер скопійовано ✓';
                clearTimeout(copyTimer);
                copyTimer = setTimeout(function () { copyPhoneBtn.textContent = copyLabel; }, 2000);
            }, function () { window.prompt('Скопіюйте номер:', PHONE); });
        });
    }

    // =================================================================
    // 3. Плавна прокрутка до секцій без зміни адреси сторінки
    // =================================================================
    var header = $('#site-header');
    var nav = $('#nav');
    var burger = $('#burger');

    function scrollToTarget(target) {
        var top = target.id === 'top' ? 0 :
            target.getBoundingClientRect().top + window.pageYOffset - (header ? header.offsetHeight : 0) + 1;
        window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
        // переносимо фокус для клавіатури та скрінрідерів
        if (target.id !== 'top') {
            target.setAttribute('tabindex', '-1');
            target.focus({ preventScroll: true });
        }
    }

    $all('a[data-scroll]').forEach(function (a) {
        a.addEventListener('click', function (e) {
            var id = (a.getAttribute('href') || '').slice(1);
            var target = id && document.getElementById(id);
            if (!target) return;
            e.preventDefault();
            closeMenu();
            scrollToTarget(target);
        });
    });

    // =================================================================
    // 4. Мобільне меню
    // =================================================================
    function openMenu() {
        nav.classList.add('is-open');
        header.classList.add('menu-open');
        document.body.classList.add('menu-open');
        burger.setAttribute('aria-expanded', 'true');
        burger.setAttribute('aria-label', 'Закрити меню');
        var first = $('.nav__link', nav);
        // фокус після того, як меню стане видимим
        if (first) setTimeout(function () { first.focus(); }, 60);
    }

    function closeMenu() {
        if (!nav || !nav.classList.contains('is-open')) return;
        nav.classList.remove('is-open');
        header.classList.remove('menu-open');
        document.body.classList.remove('menu-open');
        burger.setAttribute('aria-expanded', 'false');
        burger.setAttribute('aria-label', 'Відкрити меню');
    }

    if (burger && nav) {
        burger.addEventListener('click', function () {
            if (nav.classList.contains('is-open')) { closeMenu(); burger.focus(); }
            else openMenu();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && nav.classList.contains('is-open')) { closeMenu(); burger.focus(); }
        });
        window.addEventListener('resize', function () {
            if (window.innerWidth >= 1100) closeMenu();
        });
    }

    // =================================================================
    // 5. Усе, що залежить від прокрутки (один обробник)
    // =================================================================
    var navLinks = $all('.nav__link');
    var sections = navLinks.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    var reveals = $all('.reveal');
    var parallaxEls = reduceMotion ? [] : $all('[data-parallax]');
    var toTop = $('#to-top');
    var mobileBar = $('#mobile-bar');
    var barWatch = $all('[data-hide-mobile-bar]');
    var timeline = $('#timeline');
    var timelineBar = $('#timeline-bar');

    // невелика затримка для карток, що з'являються одночасно
    $all('.services, .features, .timeline').forEach(function (group) {
        $all('.reveal', group).forEach(function (el, i) {
            el.style.setProperty('--reveal-delay', (i % 6) * 0.08 + 's');
        });
    });

    function inView(el, offset) {
        var r = el.getBoundingClientRect();
        var vh = window.innerHeight;
        return r.top < vh - (offset || 0) && r.bottom > 0;
    }


    function onScroll() {
        var y = window.pageYOffset;
        var vh = window.innerHeight;

        // шапка
        if (header) header.classList.toggle('is-scrolled', y > 40);

        // активний пункт меню
        var current = null;
        sections.forEach(function (sec, i) {
            if (sec && sec.getBoundingClientRect().top <= vh * 0.35) current = i;
        });
        navLinks.forEach(function (a, i) {
            var active = i === current;
            a.classList.toggle('is-active', active);
            if (active) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });

        // поява елементів
        reveals.forEach(function (el) {
            if (!el.classList.contains('is-in') && inView(el, 60)) el.classList.add('is-in');
        });

        // паралакс
        parallaxEls.forEach(function (el) {
            var box = el.parentElement.getBoundingClientRect();
            if (box.bottom < 0 || box.top > vh) return;
            var speed = parseFloat(el.getAttribute('data-parallax')) || 0.1;
            var shift = (box.top + box.height / 2 - vh / 2) * -speed;
            el.style.transform = 'translate3d(0,' + shift.toFixed(1) + 'px,0)';
        });

        // лінія етапів
        if (timeline && timelineBar) {
            var tr = timeline.getBoundingClientRect();
            var vertical = window.innerWidth < 1100;
            var progress = (vh * 0.75 - tr.top) / (tr.height || 1);
            progress = Math.max(0, Math.min(1, progress));
            timelineBar.style.transform = vertical ? 'scaleY(' + progress + ')' : 'scaleX(' + progress + ')';
        }

        // кнопка "нагору"
        if (toTop) toTop.classList.toggle('is-visible', y > vh * 1.2);

        // нижня панель на телефоні — коли основні кнопки не видно
        if (mobileBar && barWatch.length) {
            var anyOnScreen = barWatch.some(function (el) { return inView(el, 0); });
            mobileBar.classList.toggle('is-visible', !anyOnScreen && y > 200);
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();

    if (toTop) {
        toTop.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
            var logo = $('.site-header .logo');
            if (logo) logo.focus({ preventScroll: true });
        });
    }

    // =================================================================
    // 6. Форма заявки: перевірка → Google Sheets → підтвердження
    // =================================================================
    var form = $('#contact-form');
    var success = $('#form-success');
    var summary = $('#form-errors');
    var successText = $('#form-success-text');
    var submitButton = form ? $('button[type="submit"]', form) : null;

    // Після розгортання Google Apps Script встав сюди URL вебзастосунку.
    var ORDERS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxRsLKxq8LsQdXwo9zPGu8kxtQVSvSy3t1s06yh8SlNZ6TUyMH8y-j23-PjM49pxCRz/exec';

    var rules = {
        name: function (v) {
            if (!v) return 'Вкажіть ваше ім\'я.';
            if (v.length < 2) return 'Ім\'я має містити щонайменше 2 символи.';
            return '';
        },
        phone: function (v) {
            if (!v) return 'Вкажіть номер телефону.';
            if (!/^[+\d\s()\-]+$/.test(v)) return 'Номер може містити лише цифри, пробіли, +, -, ( ).';
            var digits = v.replace(/\D/g, '');
            if (digits.length < 10 || digits.length > 12) return 'Перевірте номер: наприклад, +380 63 123 45 67.';
            return '';
        },
        email: function (v) {
            if (!v) return '';
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Перевірте email: наприклад, name@gmail.com.';
            return '';
        },
        message: function (v) {
            if (!v) return 'Опишіть, які роботи потрібні.';
            if (v.length < 10) return 'Опишіть задачу трохи детальніше (від 10 символів).';
            return '';
        }
    };

    function validateField(input) {
        var rule = rules[input.name];
        if (!rule) return '';
        var msg = rule(input.value.trim());
        var err = document.getElementById(input.id + '-err');
        input.setAttribute('aria-invalid', msg ? 'true' : 'false');
        input.parentElement.classList.toggle('is-valid', !msg && input.value.trim() !== '');
        if (err) err.textContent = msg;
        return msg;
    }

    function buildMessage(data) {
        return [
            'Заявка з сайту ЕЛЕКТРОБУД',
            'Ім\'я: ' + data.name,
            'Телефон: ' + data.phone,
            data.email ? 'Email: ' + data.email : null,
            '',
            data.message
        ].filter(function (line) { return line !== null; }).join('\n');
    }

    if (form && success) {
        var fields = $all('.field__input', form);

        fields.forEach(function (input) {
            input.addEventListener('blur', function () { if (input.value.trim()) validateField(input); });
            input.addEventListener('input', function () {
                if (input.getAttribute('aria-invalid') === 'true') validateField(input);
            });
        });

        // Ліміт: одна заявка раз на COOLDOWN_MIN хвилин (зберігається в браузері).
        var COOLDOWN_MIN = 10;
        var LAST_KEY = 'elektrobud_last_order';

        function lastOrderTime() {
            try { return parseInt(localStorage.getItem(LAST_KEY), 10) || 0; } catch (err) { return 0; }
        }
        function minutesLeft() {
            var left = COOLDOWN_MIN * 60000 - (Date.now() - lastOrderTime());
            return left > 0 ? Math.ceil(left / 60000) : 0;
        }
        function resetButton() {
            if (!submitButton) return;
            submitButton.disabled = false;
            submitButton.removeAttribute('aria-busy');
            submitButton.innerHTML = 'Надіслати заявку <svg aria-hidden="true"><use href="#i-arrow-right"/></svg>';
        }
        function showError(text) {
            summary.hidden = false;
            summary.textContent = text;
        }
        function showSuccess(data) {
            successText.textContent = buildMessage(data);
            form.hidden = true;
            success.hidden = false;
            success.focus();
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            if (submitButton && submitButton.disabled) return; // захист від подвійного кліку

            var errors = [];
            fields.forEach(function (input) {
                var msg = validateField(input);
                if (msg) errors.push({ input: input, msg: msg });
            });

            if (errors.length) {
                showError('Перевірте форму: ' + errors.length +
                    (errors.length === 1 ? ' поле потребує уваги.' : ' поля потребують уваги.'));
                errors[0].input.focus();
                return;
            }

            var wait = minutesLeft();
            if (wait) {
                showError('Заявку можна надсилати раз на ' + COOLDOWN_MIN + ' хв. Спробуйте через ' + wait +
                    ' хв або зателефонуйте нам.');
                return;
            }

            summary.hidden = true;
            var data = {};
            fields.forEach(function (input) { data[input.name] = input.value.trim(); });

            var body = new URLSearchParams();
            body.set('requestId', 'req-' + Date.now() + '-' + Math.random().toString(36).slice(2));
            body.set('name', data.name);
            body.set('phone', data.phone);
            body.set('email', data.email || '');
            body.set('message', data.message);
            body.set('website', ''); // honeypot проти простих ботів

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.setAttribute('aria-busy', 'true');
                submitButton.textContent = 'Надсилання…';
            }

            var controller = window.AbortController ? new AbortController() : null;
            var timer = window.setTimeout(function () { if (controller) controller.abort(); }, 20000);

            // no-cors: відповідь недоступна для читання, але якщо запит дійшов до
            // сервера (fetch не впав) — Apps Script уже виконав doPost.
            fetch(ORDERS_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: body,
                signal: controller ? controller.signal : undefined
            }).then(function () {
                window.clearTimeout(timer);
                try { localStorage.setItem(LAST_KEY, String(Date.now())); } catch (err) {}
                resetButton();
                showSuccess(data);
            }).catch(function () {
                window.clearTimeout(timer);
                resetButton();
                showError('Не вдалося надіслати заявку. Перевірте інтернет і спробуйте ще раз або напишіть нам у Telegram.');
            });
        });

        $('#form-copy').addEventListener('click', function () {
            var btn = this;
            copyText(successText.textContent, function () {
                btn.textContent = 'Скопійовано ✓';
                setTimeout(function () { btn.textContent = 'Скопіювати ще раз'; }, 2000);
            }, function () { window.prompt('Скопіюйте текст заявки:', successText.textContent); });
        });

        $('#form-telegram').addEventListener('click', function () {
            copyText(successText.textContent, function () {}, function () {});
        });

        $('#form-reset').addEventListener('click', function () {
            form.reset();
            fields.forEach(function (input) {
                input.removeAttribute('aria-invalid');
                input.parentElement.classList.remove('is-valid');
                var err = document.getElementById(input.id + '-err');
                if (err) err.textContent = '';
            });
            success.hidden = true;
            form.hidden = false;
            fields[0].focus();
        });
    }

})();
