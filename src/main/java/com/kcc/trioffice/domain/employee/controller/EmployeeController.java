package com.kcc.trioffice.domain.employee.controller;

import com.kcc.trioffice.domain.common.domain.EmployeeInfoWithDept;
import com.kcc.trioffice.domain.employee.RequestPassword;
import com.kcc.trioffice.domain.employee.dto.response.EmployeeInfo;
import com.kcc.trioffice.domain.employee.service.EmployeeService; // EmployeeService를 임포트합니다.
import com.kcc.trioffice.global.auth.PrincipalDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.parameters.P;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import lombok.RequiredArgsConstructor; // Lombok을 사용하여 생성자 주입을 간편하게 합니다.

import java.util.List;

@Controller
@RequiredArgsConstructor // Lombok을 사용하여 final 필드에 대한 생성자를 자동으로 생성합니다.
public class EmployeeController { // 'Contoller' -> 'Controller' 오타 수정
  private final EmployeeService employeeService; // EmployeeService 필드 추가

  @GetMapping("/login")
  public String login() {
    return "user/login";
  }

  @GetMapping("/find-password")
  public String findPassword() {
    return "user/find-password";
  }

  @GetMapping("/find-password/email")
  public String findPasswordEmail() {
    return "user/find-password-email";
  }

  @GetMapping("/find-password/done")
  public String findPasswordDone() {
    return "user/find-password-done";
  }

  @PutMapping("/employees/{id}")
  public ResponseEntity<String> updateEmployee(@PathVariable Long id, @RequestBody EmployeeInfo employeeInfo) {
    employeeInfo.setEmployeeId(id); // 직원 ID 설정
    employeeService.saveEmployeeFindById(employeeInfo);
    return ResponseEntity.ok("직원 정보가 업데이트되었습니다.");
  }

  // 포지션을 조회하는 엔드포인트 추가
  @GetMapping("/positions")
  public ResponseEntity<List<String>> getAllPositions() {
    List<String> positions = employeeService.getAllPositions(); // 모든 포지션 정보 조회
    return ResponseEntity.ok(positions);
  }

  @GetMapping("/")
  public String index(Model model) {
      return "redirect:/login";
  }

  @GetMapping("/employees/detail")
  public String employeeDetail(Model model, @AuthenticationPrincipal PrincipalDetail principalDetail) {
    EmployeeInfoWithDept employeeInfoWithDept = employeeService.getEmployeeInfoWithDept(principalDetail.getEmployeeId());
    model.addAttribute("employee", employeeInfoWithDept);
    return "user/detail";
  }

  @PostMapping("/employees/modify")
  public ResponseEntity<String> modifyEmployee(@RequestBody EmployeeInfo employeeInfo, @AuthenticationPrincipal PrincipalDetail principalDetail) {
    boolean isModified = employeeService.modifyEmployee(employeeInfo, principalDetail.getEmployeeId());

    if (isModified) {
      return ResponseEntity.ok("성공적으로 수정되었습니다.");
    } else {
      return ResponseEntity.status(500).body("수정에 실패하였습니다.");
    }
  }

  @GetMapping("/employees/change-password")
  public String changePassword() {
    return "user/change-password";
  }

  @PostMapping("employees/change-password")
  public ResponseEntity<String> changePassword(@AuthenticationPrincipal PrincipalDetail principalDetail, @RequestBody RequestPassword requestPassword) {
    System.out.println("변경할 password " + requestPassword.getPassword());
    boolean isChanged = employeeService.changeEmployeePassword(principalDetail.getEmployeeId(), requestPassword.getPassword());

    if (isChanged) {
      return ResponseEntity.ok("비밀번호가 변경되었습니다.");
    } else {
      return ResponseEntity.status(500).body("비밀번호 변경에 실패하였습니다.");
    }
  }

}
