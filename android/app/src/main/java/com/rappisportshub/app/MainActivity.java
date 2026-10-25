package com.rappisportshub.app;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {

    private static final String STABILIZE_CSS =
        "(function(){try{var s=document.getElementById('rappi-native-stable');" +
        "if(!s){s=document.createElement('style');s.id='rappi-native-stable';" +
        "(document.head||document.documentElement).appendChild(s);}" +
        "s.textContent='html,body{overscroll-behavior:none!important;-webkit-tap-highlight-color:transparent;touch-action:manipulation;}" +
        "html{scroll-behavior:auto!important;}';}catch(e){}})();";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        WebView webView = getBridge().getWebView();
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);

        WebSettings settings = webView.getSettings();
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);

        applySystemBarStyle();

        getBridge().addWebViewListener(
            new WebViewListener() {
                @Override
                public void onPageCommitVisible(WebView view, String url) {
                    view.evaluateJavascript(STABILIZE_CSS, null);
                    applySystemBarStyle();
                }
            }
        );

        getOnBackPressedDispatcher().addCallback(
            this,
            new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    WebView view = getBridge().getWebView();
                    if (view != null && view.canGoBack()) {
                        view.goBack();
                    } else {
                        finish();
                    }
                }
            }
        );
    }

    private void applySystemBarStyle() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(
            getWindow(),
            getWindow().getDecorView()
        );
        controller.setAppearanceLightStatusBars(true);
        controller.setAppearanceLightNavigationBars(true);
    }
}
