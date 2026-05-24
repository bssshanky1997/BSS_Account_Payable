package com.bss.accountpayable.utils;

import java.util.regex.Pattern;

public final class Constants {
  private Constants() {}

  public static final class Urls {
    public static final String LOGIN = "/Login.aspx";
    public static final String J4_LOGIN = "/j4/login.jsp";
    public static final String DASHBOARD = "/Dashboard.aspx";

    private Urls() {}
  }

  public static final class Timeouts {
    public static final double SHORT = 5_000;
    public static final double MEDIUM = 15_000;
    public static final double LONG = 30_000;
    public static final double PAGE_LOAD = 60_000;
    public static final double FILE_UPLOAD = 120_000;

    private Timeouts() {}
  }

  public static final class Tags {
    public static final String REGRESSION = "@regression";
    public static final String LOGIN = "@login";
    public static final String AP = "@ap";

    private Tags() {}
  }

  public static Pattern urlPathEndsWith(String routePath) {
    String escaped = Pattern.quote(routePath);
    return Pattern.compile(escaped + "([?#]|$)", Pattern.CASE_INSENSITIVE);
  }
}
